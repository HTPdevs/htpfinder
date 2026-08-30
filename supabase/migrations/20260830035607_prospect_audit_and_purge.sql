-- Audit trail and the real deletion path.

-- Metadata only, deliberately. The audit records that a row was written and by
-- whom, never what was in it. Copying facts into an audit table would mean a
-- deletion request could not actually be honoured, which defeats the reason
-- this data is in a database instead of in git. The slug is left out for the
-- same reason: it is derived from the business name.
create table public.prospect_audit (
  id bigint generated always as identity primary key,
  prospect_id uuid not null,
  owner_id uuid not null,
  actor_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_columns text[],
  at timestamptz not null default now()
);

comment on table public.prospect_audit is
  'Append only. Metadata about writes to prospects, never their contents. Rows survive a purge on purpose.';

create index prospect_audit_prospect_idx on public.prospect_audit (prospect_id, at desc);
create index prospect_audit_owner_idx on public.prospect_audit (owner_id, at desc);

create or replace function public.record_prospect_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into changed
    from jsonb_each(to_jsonb(new)) n
    where n.value is distinct from (to_jsonb(old) -> n.key);
  end if;

  insert into public.prospect_audit (prospect_id, owner_id, actor_id, action, changed_columns)
  values (
    coalesce(new.id, old.id),
    coalesce(new.owner_id, old.owner_id),
    auth.uid(),
    lower(tg_op),
    changed
  );

  return coalesce(new, old);
end;
$$;

create trigger prospects_audit_write
  after insert or update or delete on public.prospects
  for each row execute function public.record_prospect_write();

alter table public.prospect_audit enable row level security;
alter table public.prospect_audit force row level security;

-- Readable by its owner, writable by nobody. The only inserts come from the
-- trigger above, which runs as the definer.
create policy prospect_audit_select_own on public.prospect_audit
  for select to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.prospect_audit from anon, authenticated;
grant select on public.prospect_audit to authenticated;

-- Deletion.
--
-- deleted_at hides a row. This is what removes it. Kept as an explicit call
-- rather than a schedule, because unattended deletion of research nobody
-- reviewed is worse than a table that grows slowly.
create or replace function public.purge_deleted_prospects(older_than interval default interval '30 days')
returns integer
language plpgsql
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.prospects
  where deleted_at is not null
    and deleted_at < now() - older_than;

  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.purge_deleted_prospects(interval) is
  'Hard deletes soft deleted prospects older than the given interval. Runs under the callers RLS, so it only ever reaches their own rows.';

revoke all on function public.purge_deleted_prospects(interval) from public, anon;
grant execute on function public.purge_deleted_prospects(interval) to authenticated;

-- What the CLI reads. Keeps deleted_at filtering out of every query.
create view public.prospects_active
with (security_invoker = on)
as select * from public.prospects where deleted_at is null;

revoke all on public.prospects_active from anon;
grant select on public.prospects_active to authenticated;

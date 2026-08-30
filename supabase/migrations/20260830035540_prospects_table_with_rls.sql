-- htpfinder prospect store.
--
-- Mirrors the prospect.json contract in docs/PROSPECT-SCHEMA.md, with the
-- queryable fields promoted to columns and the document fields kept as jsonb.
-- The CLI validator stays the authority on the shape of those documents; this
-- table enforces only what the database can enforce honestly.
--
-- Deliberately absent: the verbatim Google Places response (raw.json). Google's
-- terms restrict storing Places content, and the place id is the one identifier
-- they allow keeping, so that is the only piece kept here. Everything else is
-- refetched.

create extension if not exists pgcrypto;

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  industry text not null,
  schema_version smallint not null default 1 check (schema_version = 1),

  status text not null default 'collected'
    check (status in ('collected', 'enriched', 'built', 'contacted', 'rejected')),
  provenance text not null
    check (provenance in ('google-places', 'fixture', 'manual-research')),

  -- The only Places identifier retained. Everything else is refetched.
  google_place_id text,

  score_total integer check (score_total between 0 and 100),
  score_reasons jsonb not null default '[]'::jsonb,
  website jsonb,

  facts jsonb not null,
  unresolved jsonb not null default '[]'::jsonb,
  copy jsonb,
  design jsonb,

  collected_at timestamptz not null default now(),
  enriched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Soft delete so a rejected prospect stops appearing without losing the
  -- record of having rejected it. purge_deleted_prospects() is what actually
  -- removes the row and the personal data in it.
  deleted_at timestamptz,

  constraint prospects_slug_per_owner unique (owner_id, slug),
  constraint prospects_facts_have_name check (jsonb_exists(facts, 'name')),
  constraint prospects_enriched_after_collected
    check (enriched_at is null or enriched_at >= collected_at)
);

comment on table public.prospects is
  'One researched business per row. Personal data lives in facts and copy; see purge_deleted_prospects() for the deletion path.';
comment on column public.prospects.facts is
  'Sourced claims. Every scalar is null or { value, source } with an http source URL. Never a guess.';
comment on column public.prospects.copy is
  'Editorial page text we wrote. Null until enrichment. Kept apart from facts so provenance stays checkable.';
comment on column public.prospects.google_place_id is
  'Google place id only. The rest of the Places response is not stored, per their terms.';

create index prospects_owner_score_idx
  on public.prospects (owner_id, industry, score_total desc)
  where deleted_at is null;

create index prospects_owner_status_idx
  on public.prospects (owner_id, status)
  where deleted_at is null;

create unique index prospects_place_per_owner_idx
  on public.prospects (owner_id, google_place_id)
  where google_place_id is not null and deleted_at is null;

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger prospects_touch_updated_at
  before update on public.prospects
  for each row execute function public.touch_updated_at();

-- owner_id is assigned from the session and never reassigned afterwards.
create or replace function public.freeze_owner_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id cannot be changed';
  end if;
  return new;
end;
$$;

create trigger prospects_freeze_owner_id
  before update on public.prospects
  for each row execute function public.freeze_owner_id();

-- Row level security.
--
-- Every policy is scoped to the session user. There is no shared read, because
-- prospect rows carry owner names, direct phone numbers and addresses that for
-- a sole proprietor are usually personal, plus review quotes written by named
-- third parties.
alter table public.prospects enable row level security;
alter table public.prospects force row level security;

create policy prospects_select_own on public.prospects
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy prospects_insert_own on public.prospects
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy prospects_update_own on public.prospects
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy prospects_delete_own on public.prospects
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Unauthenticated callers have no business here at all. RLS already returns
-- nothing to them, but withdrawing the grant means a future policy mistake
-- cannot accidentally expose the table.
revoke all on public.prospects from anon;
grant select, insert, update, delete on public.prospects to authenticated;

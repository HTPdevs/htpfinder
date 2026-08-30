# Supabase

Where scraped prospect data lives. `data/prospects/` on disk is test material
during development, and `.gitignore` keeps it out of git; this is the store that
is meant to hold real research.

Project `htpfinder`, region `ca-central-1`, Postgres 17.

## Why a database and not files in git

A prospect file carries an owner name, a direct phone and an address. For a
sole proprietor the last two are routinely a personal cell and a home address.
Review quotes add named third parties who never agreed to be in this project.

Git cannot forget. A table can: rows are scoped by row level security, and
`purge_deleted_prospects()` actually removes them. That difference is the whole
reason for this directory.

## Schema

`public.prospects`, one row per business. The queryable fields are columns
(`slug`, `industry`, `status`, `score_total`); the document fields stay jsonb
(`facts`, `copy`, `design`, `website`, `unresolved`) because the CLI validator
is the authority on their shape and splitting them across tables would mean
maintaining that contract twice.

`public.prospects_active` is the same table with soft deleted rows filtered
out. Read through it unless you specifically want deleted rows.

`public.prospect_audit` records that a write happened, who did it, and which
columns changed. It never records what was in them. Audit rows survive a purge,
which is only defensible because they hold no business data: `prospect_id` and
nothing identifying. The slug is left out too, since it is derived from the
business name.

Two things are deliberately absent:

- **The raw Places response.** Google's terms restrict storing Places content.
  The place id is the one identifier they allow keeping, so `google_place_id`
  is the only piece here. Everything else is refetched.
- **Any table anon can read.** There is no public surface.

## Deletion

`deleted_at` hides a row. It does not remove it.

```sql
select public.purge_deleted_prospects();                    -- older than 30 days
select public.purge_deleted_prospects(interval '0 days');   -- everything soft deleted
```

The function runs under the caller's own row level security, so it can only
ever reach their rows. It is a call rather than a schedule on purpose:
unattended deletion of research nobody reviewed is the worse failure.

To honour a removal request for one business: set `deleted_at`, then call the
purge with a zero interval. The audit row that remains says a record existed
and was deleted, and cannot say whose.

## Keys

Use the publishable key. Every policy keys off `auth.uid()`, so the CLI signs
in as a user and sees only its own rows.

The service role key bypasses row level security completely. Nothing in this
tool needs it, and putting it in a `.env` on a laptop makes every policy in
`migrations/` decorative. If something eventually needs it, that something runs
on a server.

## Migrations

Applied in order, filenames are the version. They are mirrored here from what
is live so the schema is reviewable in git alongside the code that depends on
it.

After any schema change, check the linter, which catches a missing policy
faster than reading the diff does:

```
get_advisors(type: "security")
```

It should come back empty. It currently does.

## Verified

A probe run against the live database, in a transaction that cleaned up after
itself, confirmed all sixteen: an owner reads only their own rows, a second
user reads, updates and deletes nothing, an insert claiming another user's
`owner_id` is rejected, `owner_id` cannot be reassigned after the fact, `anon`
has no grant on either table or on the purge function, the active view hides
soft deleted rows while the base table keeps them, purge hard deletes, audit
rows survive it, the audit names the changed column, the audit contains no
business data, and a user cannot forge an audit row.

Worth rerunning after any change to a policy or a grant.

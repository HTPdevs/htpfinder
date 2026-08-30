-- Supabase installs this as an event trigger that turns RLS on for any new
-- table in `public`. Worth keeping, but it does not need to be callable over
-- the REST API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

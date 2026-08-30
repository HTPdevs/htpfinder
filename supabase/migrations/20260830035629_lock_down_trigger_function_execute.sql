-- PostgREST exposes every function in `public` as an RPC endpoint, trigger
-- functions included. record_prospect_write() is SECURITY DEFINER, so leaving
-- EXECUTE granted means anyone with a key can reach a definer function. It
-- would error outside a trigger context rather than write anything, but a
-- definer function reachable from the internet is not something to leave open
-- on the strength of that.
revoke all on function public.record_prospect_write() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.freeze_owner_id() from public, anon, authenticated;

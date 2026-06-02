-- security: revoke EXECUTE from PUBLIC on SECURITY DEFINER functions
-- where anon should not be able to call them.
--
-- Postgres default for new functions is "GRANT EXECUTE ... TO PUBLIC",
-- and anon inherits from PUBLIC. The role-targeted REVOKEs in
-- 20260601_020000 and 20260601_080000 had no runtime effect because
-- PUBLIC kept the grant alive — this migration removes that path.
--
-- Functions intentionally left PUBLIC-executable:
--   public.get_public_org_id()
--     storefront resolves the public org from anon context
--   public.get_user_org_ids()
--     referenced from many RLS policies; anon evaluates those during
--     OR-merged policy checks, so anon must be able to invoke (returns
--     empty for anon, so it leaks nothing)
--   public.reserve_availability_if_available(...)
--     called from anon checkout flow (lib/availability/blocks.ts:45)

-- Service-role only callers (admin client):
revoke execute on function public.apply_rate_limit(text, text, integer, integer) from public;
revoke execute on function public.handle_new_user() from public;

-- Authenticated only callers (signed-in dashboard / onboarding):
revoke execute on function public.bootstrap_organization(text, text, text, numeric, numeric) from public;
revoke execute on function public.bootstrap_organization(text, text, text, numeric, numeric, text) from public;
revoke execute on function public.bootstrap_organization(text, text, text, text, numeric, numeric, text) from public;
revoke execute on function public.mark_org_setup_step(uuid, text) from public;
revoke execute on function public.record_manual_payment(uuid, uuid, numeric, text, text, text, timestamptz) from public;

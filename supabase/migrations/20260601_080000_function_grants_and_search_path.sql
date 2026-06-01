-- security: revoke unnecessary anon EXECUTE on functions that already
-- enforce auth internally (or that should never be called by anon);
-- pin search_path on trigger functions.
--
-- Keeping anon EXECUTE on:
--   get_public_org_id        - storefront resolves the public org by id
--                              (anon needs this; body is read-only)
--
-- bootstrap_organization has 3 overloads, all of which raise when
-- auth.uid() is null. Anon EXECUTE was harmless but unnecessary.
revoke execute on function public.bootstrap_organization(text, text, text, numeric, numeric) from anon;
revoke execute on function public.bootstrap_organization(text, text, text, numeric, numeric, text) from anon;
revoke execute on function public.bootstrap_organization(text, text, text, text, numeric, numeric, text) from anon;

-- get_user_org_ids returns empty for anon (where profile_id = auth.uid()).
-- No legitimate anon caller; remove the surface.
revoke execute on function public.get_user_org_ids() from anon;

-- handle_new_user is a trigger function on auth.users insert. Should
-- only be called by the trigger context. Remove direct-call surface
-- from anon and authenticated.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Trigger functions: pin search_path. Not SECURITY DEFINER, so the
-- risk is low; this satisfies the lint and prevents accidental
-- shadowing by a same-named function in a different schema.
alter function public.set_row_updated_at() set search_path = '';
alter function public.set_updated_at() set search_path = '';
alter function public.ensure_updated_at_trigger(regclass, text) set search_path = '';

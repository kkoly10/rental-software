-- Fix: Add missing UPDATE RLS policy on the organizations table.
--
-- Without this policy every client-side UPDATE on organizations silently
-- returns 0 rows because RLS blocks the write.  This caused the slug
-- chosen during onboarding (and any later slug change from the domain-
-- settings panel) to be silently dropped, leaving the temporary RPC-
-- generated slug in place and producing 404s on the tenant storefront URL.

-- Guard: drop if it somehow already exists (idempotent re-run).
drop policy if exists "Org members can update their own organizations" on public.organizations;

create policy "Org members can update their own organizations"
  on public.organizations for update
  using (id in (select public.get_user_org_ids()));

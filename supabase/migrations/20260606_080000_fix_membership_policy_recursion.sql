-- Fix infinite recursion (42P17) in the organization_memberships UPDATE/DELETE
-- policies — found by the RBAC Playwright suite hitting the real REST API as an
-- authenticated user (service-role SQL never sees it because it bypasses RLS).
--
-- Both policies tested "is the caller an owner/admin of this org?" with an
-- inline `EXISTS (SELECT 1 FROM organization_memberships om ...)`. Because that
-- subquery reads the very table the policy is on, Postgres re-applies the policy
-- and aborts with "infinite recursion detected in policy". The practical effect:
-- ANY authenticated UPDATE/DELETE on a membership errored out — so legitimate
-- owner/admin role management (lib/team/actions.ts updateMemberRole /
-- removeMember) was broken, not just the self-escalation attempt.
--
-- Fix: use the existing user_has_org_role() SECURITY DEFINER helper (added in
-- 20260606_050000), whose internal read bypasses RLS, so there's no recursion.
-- The "or themselves" self-branch is kept; the trg_membership_privilege_guard
-- trigger (20260606_060000) still blocks a member from changing their OWN
-- role/status, so self-escalation remains denied — now by the trigger, by
-- design, instead of by an error.

DROP POLICY IF EXISTS "Members can be updated by org owners/admins or themselves" ON public.organization_memberships;
CREATE POLICY "Members can be updated by org owners/admins or themselves"
  ON public.organization_memberships
  FOR UPDATE TO public
  USING (
    user_has_org_role(organization_id, ARRAY['owner','admin'])
    OR profile_id = auth.uid()
  );

DROP POLICY IF EXISTS "Members can be deleted by org owners/admins or themselves" ON public.organization_memberships;
CREATE POLICY "Members can be deleted by org owners/admins or themselves"
  ON public.organization_memberships
  FOR DELETE TO public
  USING (
    user_has_org_role(organization_id, ARRAY['owner','admin'])
    OR profile_id = auth.uid()
  );

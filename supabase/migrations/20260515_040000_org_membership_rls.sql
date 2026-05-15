-- Add missing UPDATE and DELETE RLS policies on organization_memberships.
--
-- INSERT policy existed but UPDATE/DELETE were absent, relying solely on
-- application-layer checks. Defense-in-depth requires RLS for all mutation ops.
--
-- Rules:
--   UPDATE — only owners/admins of the organization can change roles/status
--   DELETE — only owners/admins of the organization can remove members
--
-- Both policies allow a member to update/delete their OWN row so that
-- self-removal (leave org) works without requiring elevated role.

create policy "Members can be updated by org owners/admins or themselves"
  on organization_memberships
  for update
  using (
    -- The acting user is an owner or admin of this org
    exists (
      select 1 from organization_memberships om
      where om.organization_id = organization_memberships.organization_id
        and om.profile_id = auth.uid()
        and om.role in ('owner', 'admin')
        and om.status = 'active'
    )
    -- OR the user is updating their own membership (e.g., changing settings)
    or profile_id = auth.uid()
  );

create policy "Members can be deleted by org owners/admins or themselves"
  on organization_memberships
  for delete
  using (
    exists (
      select 1 from organization_memberships om
      where om.organization_id = organization_memberships.organization_id
        and om.profile_id = auth.uid()
        and om.role in ('owner', 'admin')
        and om.status = 'active'
    )
    or profile_id = auth.uid()
  );

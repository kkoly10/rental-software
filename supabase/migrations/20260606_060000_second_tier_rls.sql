-- Second-tier RBAC hardening: close the membership self-escalation hole and
-- role-gate writes on the tables related to the "big four" (option 3 follow-up).
--
-- 1) organization_memberships — a member could UPDATE their OWN row with no
--    WITH CHECK on the new values, i.e. self-promote to owner or reactivate a
--    suspended status. A BEFORE UPDATE trigger now rejects any change to
--    `role`/`status` unless the acting user is an owner/admin of that org.
--    (Service-role / SECURITY DEFINER backend paths have auth.uid() = NULL and
--    are trusted, so they're exempt. Non-privilege column edits are untouched.)
-- 2) order_items / documents / customer_addresses — were FOR ALL role-blind, so
--    a viewer could edit line-item prices, signed legal docs, or address PII via
--    a direct API call. Now: members read; owner/admin/dispatcher write. (Mirrors
--    the orders/customers/documents server actions; storefront anon INSERTs keep
--    their own policies; portal signing + the geocode cache use the admin client.)
-- 3) team_invites — the "manage" policy was role-blind, letting any member create
--    or alter invites (e.g. invite an accomplice at an elevated role). Now
--    restricted to owner/admin. The members SELECT (view) policy is unchanged.
--
-- Uses the user_has_org_role() helper added in 20260606_050000.

-- 1. ORGANIZATION_MEMBERSHIPS — privilege-change guard --------------------------
CREATE OR REPLACE FUNCTION public.enforce_membership_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only role/status are privilege-bearing. Trusted backend paths (service role,
  -- SECURITY DEFINER functions) run with auth.uid() = NULL and are allowed.
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status)
     AND auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.organization_id = NEW.organization_id
        AND om.profile_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Only owners/admins can change a member''s role or status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_membership_privilege_guard ON public.organization_memberships;
CREATE TRIGGER trg_membership_privilege_guard
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_membership_privilege_changes();

-- 2. ORDER_ITEMS --------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can manage order items" ON public.order_items;

CREATE POLICY "Org members can read order items" ON public.order_items
  FOR SELECT TO public
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE organization_id IN (SELECT get_user_org_ids())
    )
  );

CREATE POLICY "Operators can insert order items" ON public.order_items
  FOR INSERT TO public
  WITH CHECK (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE user_has_org_role(o.organization_id, ARRAY['owner','admin','dispatcher'])
    )
  );

CREATE POLICY "Operators can update order items" ON public.order_items
  FOR UPDATE TO public
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE user_has_org_role(o.organization_id, ARRAY['owner','admin','dispatcher'])
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE user_has_org_role(o.organization_id, ARRAY['owner','admin','dispatcher'])
    )
  );

CREATE POLICY "Operators can delete order items" ON public.order_items
  FOR DELETE TO public
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE user_has_org_role(o.organization_id, ARRAY['owner','admin','dispatcher'])
    )
  );

-- 3. DOCUMENTS ----------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can manage documents" ON public.documents;

CREATE POLICY "Org members can read documents" ON public.documents
  FOR SELECT TO public
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Operators can insert documents" ON public.documents
  FOR INSERT TO public
  WITH CHECK (user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher']));

CREATE POLICY "Operators can update documents" ON public.documents
  FOR UPDATE TO public
  USING (user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher']))
  WITH CHECK (user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher']));

CREATE POLICY "Operators can delete documents" ON public.documents
  FOR DELETE TO public
  USING (user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher']));

-- 4. CUSTOMER_ADDRESSES -------------------------------------------------------
-- Drops the old policy's `organization_id IS NULL` branch (0 such rows) so
-- members can't reach null-org addresses. Anon storefront INSERT policy kept.
DROP POLICY IF EXISTS "Org direct match for customer addresses" ON public.customer_addresses;

CREATE POLICY "Org members can read customer addresses" ON public.customer_addresses
  FOR SELECT TO public
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Operators can insert customer addresses" ON public.customer_addresses
  FOR INSERT TO public
  WITH CHECK (user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher']));

CREATE POLICY "Operators can update customer addresses" ON public.customer_addresses
  FOR UPDATE TO public
  USING (user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher']))
  WITH CHECK (user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher']));

CREATE POLICY "Operators can delete customer addresses" ON public.customer_addresses
  FOR DELETE TO public
  USING (user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher']));

-- 5. TEAM_INVITES -------------------------------------------------------------
-- Restrict create/modify/delete to owner/admin (the policy was named that but
-- only checked membership). The "Org members can view invites" SELECT policy is
-- left unchanged. Invite acceptance by a not-yet-member invitee never relied on
-- this membership-scoped policy and is unaffected.
DROP POLICY IF EXISTS "Org owners/admins can manage invites" ON public.team_invites;

CREATE POLICY "Admins can insert invites" ON public.team_invites
  FOR INSERT TO public
  WITH CHECK (user_has_org_role(organization_id, ARRAY['owner','admin']));

CREATE POLICY "Admins can update invites" ON public.team_invites
  FOR UPDATE TO public
  USING (user_has_org_role(organization_id, ARRAY['owner','admin']))
  WITH CHECK (user_has_org_role(organization_id, ARRAY['owner','admin']));

CREATE POLICY "Admins can delete invites" ON public.team_invites
  FOR DELETE TO public
  USING (user_has_org_role(organization_id, ARRAY['owner','admin']));

-- Role-aware write RLS for orders / customers / organizations.
--
-- Audit follow-up (option 3, tables 2-4 of 4). These tables' write policies
-- were FOR ALL gated only on org membership (role-blind), so a read-only
-- `viewer` (and, for org settings, any non-admin) could write directly via the
-- API, bypassing the app-layer role gates. We mirror the app's actual role
-- floors into RLS so the database enforces them too — defense in depth.
--
-- The allow-lists are the exact union of roles that legitimately write each
-- table via the user (authenticated) client, so no working flow breaks:
--   - orders:        owner/admin/dispatcher (orders/quotes/routes/payments
--                    actions) + crew (the delivered/picked-up status flip in
--                    lib/crew/actions.ts done with the user client).
--   - customers:     owner/admin/dispatcher (orders/customers actions).
--   - organizations: owner/admin (settings/domains/stripe/onboarding/account).
--
-- Paths that bypass these unaffected: storefront anon INSERTs keep their own
-- TO anon policies; the customer portal, crons, Stripe webhook, Twilio inbound
-- and the OAuth connection modules use the service-role/admin client; crew
-- assignment-scoped mutations and record_manual_payment() use SECURITY DEFINER
-- RPCs. Member SELECT (read) stays open to all members on every table.

-- 1. Helper: does the current user hold one of the given roles in the org?
--    Mirrors get_user_org_ids() (profile_id = auth.uid(), status = 'active').
CREATE OR REPLACE FUNCTION public.user_has_org_role(p_org_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_memberships
    WHERE organization_id = p_org_id
      AND profile_id = auth.uid()
      AND status = 'active'
      AND role = ANY(p_roles)
  );
$$;
REVOKE ALL ON FUNCTION public.user_has_org_role(uuid, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.user_has_org_role(uuid, text[]) TO anon, authenticated;

-- 2. ORDERS ------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can manage orders" ON public.orders;

CREATE POLICY "Org members can read orders" ON public.orders
  FOR SELECT TO public
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Operators can insert orders" ON public.orders
  FOR INSERT TO public
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher','crew'])
  );

CREATE POLICY "Operators can update orders" ON public.orders
  FOR UPDATE TO public
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher','crew'])
  )
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher','crew'])
  );

CREATE POLICY "Operators can delete orders" ON public.orders
  FOR DELETE TO public
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher','crew'])
  );

-- 3. CUSTOMERS ---------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can manage customers" ON public.customers;

CREATE POLICY "Org members can read customers" ON public.customers
  FOR SELECT TO public
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Operators can insert customers" ON public.customers
  FOR INSERT TO public
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher'])
  );

CREATE POLICY "Operators can update customers" ON public.customers
  FOR UPDATE TO public
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher'])
  )
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher'])
  );

CREATE POLICY "Operators can delete customers" ON public.customers
  FOR DELETE TO public
  USING (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_role(organization_id, ARRAY['owner','admin','dispatcher'])
  );

-- 4. ORGANIZATIONS -----------------------------------------------------------
-- Only tighten UPDATE (settings live here). INSERT bootstrap + SELECT policies
-- are unchanged.
DROP POLICY IF EXISTS "Org members can update their own organizations" ON public.organizations;

CREATE POLICY "Admins can update their own organizations" ON public.organizations
  FOR UPDATE TO public
  USING (
    id IN (SELECT get_user_org_ids())
    AND user_has_org_role(id, ARRAY['owner','admin'])
  )
  WITH CHECK (
    id IN (SELECT get_user_org_ids())
    AND user_has_org_role(id, ARRAY['owner','admin'])
  );

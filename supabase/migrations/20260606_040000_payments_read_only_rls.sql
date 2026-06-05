-- Payments: remove direct table writes for every member (read-only for members).
--
-- Audit follow-up (option 3, table 1 of 4). The old "Org members can manage
-- payments" policy was FOR ALL TO public gated only on org membership — so any
-- member, including a read-only `viewer`, could INSERT/UPDATE/DELETE payment
-- rows directly via the API, bypassing the owner/admin/dispatcher app gate AND
-- the financial-integrity logic (balance validation, row-locking, cached-balance
-- recompute) that lives in record_manual_payment().
--
-- Every legitimate payment WRITE already bypasses table RLS:
--   - record_manual_payment()  — SECURITY DEFINER, enforces the role + integrity
--   - Stripe webhook           — service-role (admin) client
-- and no app code writes payments via the user client. So the correct posture is
-- read-only for members with default-deny on direct writes.

DROP POLICY IF EXISTS "Org members can manage payments" ON public.payments;

CREATE POLICY "Org members can read payments" ON public.payments
  FOR SELECT TO public
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE organization_id IN (SELECT get_user_org_ids())
    )
  );

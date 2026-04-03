-- Backfill migration: Recompute balance_due_amount from the payments table
-- for all orders that have at least one payment record.
--
-- balance_due_amount is a cached field kept in sync by the application layer.
-- This migration fixes any stale values caused by payments recorded before the
-- computed-balance pattern was introduced.
--
-- Formula: balance = total_amount - (sum of non-refund payments) + (sum of refunds)

UPDATE orders o
SET balance_due_amount = o.total_amount - COALESCE(
  (
    SELECT
      SUM(CASE WHEN p.payment_type = 'refund' THEN -p.amount ELSE p.amount END)
    FROM payments p
    WHERE p.order_id = o.id
      AND p.payment_status = 'paid'
  ),
  0
)
WHERE EXISTS (
  SELECT 1 FROM payments p WHERE p.order_id = o.id
);

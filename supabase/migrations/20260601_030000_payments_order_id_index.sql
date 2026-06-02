-- payments.order_id: base index for per-order payment lookups.
--
-- The existing partial unique `idx_payments_provider_payment_id_unique` covers
-- `(order_id, provider_payment_id) WHERE provider_payment_id IS NOT NULL` — fine
-- for Stripe-mediated payments, but cash / check / Venmo / Zelle payments leave
-- provider_payment_id null and therefore aren't in that index. Per-order lookups
-- in `lib/payments/financials.ts` and the analytics + portal flows then fall
-- back to a sequential scan over the whole payments table.
--
-- Deploy-safety: additive schema change, no data writes, no app-code dependency.
-- Safe to apply before or after the new code. If the payments table is large
-- enough that the brief ACCESS EXCLUSIVE lock during build is a concern, run
-- the equivalent CREATE INDEX CONCURRENTLY in the Supabase SQL editor instead
-- (cannot run inside the migration transaction).

create index if not exists idx_payments_order_id
  on public.payments (order_id);

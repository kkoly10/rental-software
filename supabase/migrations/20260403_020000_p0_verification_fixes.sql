-- P0 verification fixes: webhook idempotency, subscription cancellation tracking

-- V2: Prevent duplicate Stripe payment records.
-- The webhook handler uses a SELECT-then-INSERT pattern which has a TOCTOU race window.
-- This partial unique index is the database-level last line of defense: if two concurrent
-- webhook deliveries both pass the app-level dedup check, the second INSERT will fail
-- rather than creating a duplicate payment row.
create unique index if not exists idx_payments_provider_payment_id_unique
  on payments (order_id, provider_payment_id)
  where provider_payment_id is not null;

-- V7: Store the actual subscription cancellation timestamp separately from updated_at.
-- updated_at is auto-set on ANY org row change (name, settings, etc.), so using it
-- as the grace-period baseline allows operators to accidentally extend the grace period
-- by editing any setting. subscription_canceled_at is only set by the webhook handler
-- when the subscription is actually deleted.
alter table public.organizations
  add column if not exists subscription_canceled_at timestamptz;

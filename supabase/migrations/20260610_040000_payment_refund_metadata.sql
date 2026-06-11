-- PR-1 #2 — Stripe refund tracking on payments.
--
-- Before: payment_type='refund' rows existed but carried no link to
-- the actual Stripe refund object, so reconciling a real refund vs.
-- a manual cash adjustment required reading Stripe's dashboard.
--
-- Now: when the operator-initiated refund action calls
-- stripe.refunds.create, the resulting re_xxx id lands here. The
-- webhook handler for refund.updated/refund.failed flips
-- payment_status based on the re_xxx round-trip.
--
-- refund_reason is the operator-entered reason string; surfaced on
-- the order detail card and exported to QuickBooks/Xero CSV.

alter table public.payments
  add column if not exists stripe_refund_id text,
  add column if not exists refund_reason text;

-- Unique guard: one refund row per Stripe refund object. Prevents
-- a webhook + manual recording from creating two rows for the same
-- re_xxx.
create unique index if not exists payments_stripe_refund_id_idx
  on public.payments (stripe_refund_id)
  where stripe_refund_id is not null;

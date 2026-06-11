-- Marketplace M3 — payment wiring (spec §15, §23; decision record in
-- docs/marketplace/master-plan.md): marketplace checkout uses
-- DESTINATION charges on the platform account with
-- application_fee_amount + transfer_data.destination pointing at the
-- seller's existing Connect Express account (built in PR #320).
-- Operator-storefront checkout keeps its direct-charge model — the
-- two surfaces share the Connect account, nothing else.

alter table public.market_bookings
  add column if not exists stripe_checkout_session_id text;

create unique index if not exists market_bookings_checkout_session_idx
  on public.market_bookings (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- Dedicated webhook event ledger for the marketplace endpoint
-- (/api/market/stripe/webhooks). Mirrors stripe_webhook_events'
-- claim/succeed/fail state machine so a crash between claim and
-- completion can be retried, and a duplicate delivery is a no-op.
create table if not exists public.market_stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processing_status text not null default 'claimed'
    check (processing_status in ('claimed','succeeded','failed')),
  attempt_count integer not null default 1,
  last_error text,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.market_stripe_webhook_events enable row level security;
-- Service-role only (no policies) — same posture as the operator ledger.

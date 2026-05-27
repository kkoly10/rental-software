-- Idempotency ledger for Stripe webhooks. Stripe retries deliveries and can
-- deliver out of order, so the handler claims each event id before processing
-- to avoid double-applying side effects (duplicate refund emails, repeated
-- subscription syncs, etc.).
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

-- Only the service-role webhook handler (which bypasses RLS) touches this table.
alter table public.stripe_webhook_events enable row level security;

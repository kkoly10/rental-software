-- Marketplace M4 slice 2 — §9 deposit lifecycle columns.
--
-- The deposit is AUTHORIZED (manual-capture PaymentIntent on the
-- platform account, off-session on the card saved at booking payment)
-- at handoff minus <=96h, never at booking time, and released on
-- completion. deposit_status tracks that machine:
--   none     — deposit_cents = 0, nothing to do
--   scheduled— booking paid; the hourly cron places the hold when the
--              96h window opens
--   held     — auth hold live on the renter's card
--   released — hold cancelled after clean return / completion
--   captured — (disputes, later) hold captured toward a claim
--   failed   — off-session auth failed; surfaced for manual follow-up

alter table public.market_bookings
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists deposit_status text not null default 'none'
    check (deposit_status in ('none','scheduled','held','released','captured','failed'));

create index if not exists market_bookings_deposit_due_idx
  on public.market_bookings (deposit_status, starts_at)
  where deposit_status = 'scheduled';

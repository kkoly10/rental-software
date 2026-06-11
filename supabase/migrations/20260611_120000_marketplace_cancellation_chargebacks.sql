-- Cancellation/refund engine, no-shows, late fees, chargebacks.
-- Policy numbers per the approved decision record (2026-06-11):
-- Flexible 24h/0h · Standard 72h/24h · Strict 7d/72h presets by risk
-- family; 1h post-booking grace; deposits always released on cancel;
-- seller cancels refund 100% and hit ranking; Turo-style no-shows and
-- late fees (1x daily + $20/started day, 3-day cap then non_return
-- dispute); Stripe-prescribed chargeback handling (immediate transfer
-- reversal on dispute.created).

alter table public.market_bookings
  add column if not exists refund_cents integer not null default 0 check (refund_cents >= 0),
  add column if not exists cancelled_by text check (cancelled_by in ('renter','seller','system')),
  add column if not exists cancel_reason text check (char_length(cancel_reason) <= 200),
  add column if not exists late_fee_cents integer not null default 0 check (late_fee_cents >= 0),
  add column if not exists late_days_charged integer not null default 0 check (late_days_charged >= 0);

-- System can open disputes now (automatic non_return escalation).
alter table public.market_disputes
  drop constraint if exists market_disputes_opened_by_check;
alter table public.market_disputes
  add constraint market_disputes_opened_by_check
  check (opened_by in ('renter','seller','system'));

-- §15: chargebacks are a separate system from marketplace disputes.
create table if not exists public.market_chargebacks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.market_bookings(id) on delete set null,
  stripe_dispute_id text not null unique,
  stripe_charge_id text,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'open' check (status in ('open','won','lost')),
  transfer_reversed boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists market_chargebacks_open_idx
  on public.market_chargebacks (status) where status = 'open';

alter table public.market_chargebacks enable row level security;
-- Service-role only; surfaced to the platform admin via the trust queue.

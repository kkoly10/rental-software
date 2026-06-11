-- Roadmap item 4 (master plan §18/§19): rental extension requests.
-- Research-locked design (2026-06-11): charge at approval on the saved
-- card (Turo/Outdoorsy); auto-approve only for instant-book listings
-- with no conflict (Getaround); 12h seller window, lapse = declined
-- terms stand (Turo); pending requests suppress late-fee accrual and
-- approval retroactively un-lates an overdue booking.

create table if not exists public.market_extension_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.market_bookings(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  -- Snapshots so approval math and un-lating are auditable.
  previous_ends_at timestamptz not null,
  requested_ends_at timestamptz not null,
  extension_days integer not null check (extension_days between 1 and 30),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  payout_cents integer not null default 0 check (payout_cents >= 0),
  state text not null default 'pending'
    check (state in ('pending','approved','declined','lapsed','failed')),
  auto_approved boolean not null default false,
  stripe_payment_intent_id text,
  expires_at timestamptz not null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists market_ext_requests_booking_idx
  on public.market_extension_requests (booking_id, created_at desc);
create index if not exists market_ext_requests_pending_idx
  on public.market_extension_requests (expires_at)
  where state = 'pending';

alter table public.market_extension_requests enable row level security;
-- Both booking parties may read; all writes via server actions.
create policy market_ext_requests_party_read on public.market_extension_requests
  for select to authenticated
  using (
    booking_id in (
      select b.id from public.market_bookings b
      where b.renter_profile_id = auth.uid()
         or b.organization_id in (select public.get_user_org_ids())
    )
  );

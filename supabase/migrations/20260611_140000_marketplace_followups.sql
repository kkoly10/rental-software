-- Post-rental follow-ups (founder decision 2026-06-11): after a
-- rental completes, BOTH parties answer a short structured survey —
-- how it went, item issues, anything suspicious. Flagged answers
-- (item_issue / suspicious / overall=problem) surface in the platform
-- trust queue; clean ones feed the quality picture quietly.

create table if not exists public.market_followups (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.market_bookings(id) on delete cascade,
  party text not null check (party in ('renter','seller')),
  overall text not null check (overall in ('great','okay','problem')),
  item_issue boolean not null default false,
  suspicious boolean not null default false,
  -- seller-only signal (null for renters): would you rent to them again?
  would_repeat boolean,
  notes text check (char_length(notes) <= 2000),
  status text not null default 'clean' check (status in ('clean','flagged','reviewed')),
  created_at timestamptz not null default now(),
  unique (booking_id, party)
);

create index if not exists market_followups_flagged_idx
  on public.market_followups (status, created_at)
  where status = 'flagged';

alter table public.market_followups enable row level security;
create policy market_followups_own_read on public.market_followups
  for select to authenticated
  using (
    booking_id in (
      select b.id from public.market_bookings b
      where b.renter_profile_id = auth.uid()
         or b.organization_id in (select public.get_user_org_ids())
    )
  );

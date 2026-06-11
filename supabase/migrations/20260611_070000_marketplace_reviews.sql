-- Marketplace M6 (slice 1) — reviews. One review per booking, renter-
-- authored, only after completion (verified-rental reviews only; the
-- action enforces the state check, the unique constraint enforces
-- one-per-booking).

create table if not exists public.market_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.market_bookings(id) on delete cascade,
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  renter_profile_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists market_reviews_org_idx
  on public.market_reviews (organization_id, created_at desc);
create index if not exists market_reviews_listing_idx
  on public.market_reviews (listing_id, created_at desc);

alter table public.market_reviews enable row level security;

-- Reviews are public trust signals — anyone may read them.
create policy market_reviews_public_read on public.market_reviews
  for select to anon, authenticated using (true);
-- Writes via the server action only.

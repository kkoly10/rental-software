-- Marketplace support channel (§19 queue #3 — booking support).
-- Works signed-in or signed-out (email required either way); requests
-- land in the platform-admin trust queue.

create table if not exists public.market_support_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  email text not null check (char_length(email) <= 320),
  topic text not null check (topic in ('booking','payment','listing','account','other')),
  booking_id uuid references public.market_bookings(id) on delete set null,
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'open' check (status in ('open','resolved')),
  resolution_note text check (char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists market_support_open_idx
  on public.market_support_requests (status, created_at)
  where status = 'open';

alter table public.market_support_requests enable row level security;
-- Signed-in submitters can see their own requests; writes via server
-- actions only (email is PII).
create policy market_support_own_read on public.market_support_requests
  for select to authenticated
  using (profile_id = auth.uid());

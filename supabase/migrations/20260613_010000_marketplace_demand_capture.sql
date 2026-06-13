-- Phase 2 (build tracker): demand capture.
--
-- Two pieces:
--   1. market_demand_requests — a richer demand-intent capture than the
--      world waitlist: a renter (or anonymous visitor) tells us what
--      they need, when, where, and how much they'd pay. This is the
--      supply-acquisition to-do list (research rule #1: demand is the
--      scarce side). Service-role-only (emails/phones are PII), same
--      lockdown posture as market_world_waitlist.
--   2. result_count on market_demand_events — so a zero-result search
--      is distinguishable from a search that found listings (the
--      `had_results` analytics signal).

create table if not exists public.market_demand_requests (
  id uuid primary key default gen_random_uuid(),
  -- nullable: anonymous visitors can submit from a no-results page
  renter_profile_id uuid references public.profiles(id) on delete set null,
  world_slug text,
  category_slug text,
  -- free text: "28ft extension ladder", "wedding photographer", "DJ"
  query text not null check (char_length(query) between 1 and 300),
  metro_slug text not null default 'dmv',
  zip_code text check (zip_code is null or char_length(zip_code) <= 12),
  needed_start_date date,
  needed_end_date date,
  delivery_required boolean not null default false,
  budget_cents integer check (budget_cents is null or budget_cents >= 0),
  email text not null check (char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 32),
  notes text check (notes is null or char_length(notes) <= 2000),
  -- where the form was submitted from (search / category / homepage)
  source_page text,
  status text not null default 'new'
    check (status in ('new','matched','notified','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_demand_requests_triage_idx
  on public.market_demand_requests (status, created_at);
create index if not exists market_demand_requests_segment_idx
  on public.market_demand_requests (metro_slug, world_slug, created_at);

alter table public.market_demand_requests enable row level security;
-- Service-role only (PII): no client policies; lock down grants like
-- the other demand tables.
revoke all on table public.market_demand_requests from anon, authenticated;

-- Zero-result distinguishability on search logging.
alter table public.market_demand_events
  add column if not exists result_count integer;

-- Marketplace M0/M1 foundation (MARKETPLACE_BUILD_PLAN.md sprints M0–M1).
--
-- Bounded-context note: the build plan called for a separate `market`
-- Postgres schema. Supabase's data API only exposes `public` (and this
-- environment cannot change the project's exposed-schemas setting), so
-- the boundary is enforced by the `market_` prefix + marketplace-only
-- RLS instead. Rule 2 still holds: marketplace tables reference shared
-- IDENTITY tables only (organizations, products) — never operator flow
-- tables (orders, routes, payments).
--
-- Worlds / categories / risk families are configuration-as-code in
-- lib/market/registry (same pattern as lib/capabilities); these tables
-- store world/category SLUGS, validated app-side against the registry.

-- ── Seller profiles (spec §22: store PAGES, not websites) ────────────
create table if not exists public.market_seller_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  slug text not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$'),
  display_name text not null check (char_length(display_name) between 2 and 80),
  bio text check (char_length(bio) <= 600),
  metro_slug text not null default 'dmv',
  service_radius_miles integer not null default 15
    check (service_radius_miles between 1 and 200),
  offers_delivery boolean not null default true,
  offers_pickup boolean not null default true,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_seller_profiles enable row level security;

-- Anyone may view an active seller's store page (one marketplace site,
-- no storefront-slug header involved — this is NOT the tenant model).
create policy market_seller_profiles_public_read on public.market_seller_profiles
  for select
  to anon, authenticated
  using (status = 'active');

-- Owners/admins manage their own profile.
create policy market_seller_profiles_org_write on public.market_seller_profiles
  for all
  to authenticated
  using (public.user_has_org_role(organization_id, array['owner','admin']))
  with check (public.user_has_org_role(organization_id, array['owner','admin']));

-- ── Listings ─────────────────────────────────────────────────────────
create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Optional link back to the operator's catalog product (ID-only
  -- reference; marketplace logic never reads operator order flow).
  product_id uuid references public.products(id) on delete set null,
  world_slug text not null,
  category_slug text not null,
  risk_family_slug text not null,
  title text not null check (char_length(title) between 4 and 140),
  description text check (char_length(description) <= 4000),
  condition text not null default 'good'
    check (condition in ('new','excellent','good','fair','worn')),
  acquired_year integer check (acquired_year between 1990 and 2100),
  replacement_value_cents integer check (replacement_value_cents >= 0),
  daily_price_cents integer not null check (daily_price_cents > 0),
  weekend_price_cents integer check (weekend_price_cents > 0),
  weekly_price_cents integer check (weekly_price_cents > 0),
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  inventory_mode text not null default 'serialized'
    check (inventory_mode in ('serialized','quantity','bundle')),
  quantity integer not null default 1 check (quantity >= 1),
  prep_buffer_minutes integer not null default 60 check (prep_buffer_minutes >= 0),
  recovery_buffer_minutes integer not null default 240 check (recovery_buffer_minutes >= 0),
  offers_delivery boolean not null default false,
  offers_pickup boolean not null default true,
  metro_slug text not null default 'dmv',
  photo_url text,
  -- Smoke-test worlds accept pre-listings: published-but-not-bookable
  -- demand signals (spec §31). Booking RPCs must reject is_prelist rows.
  is_prelist boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft','pending_review','published','paused','rejected')),
  rejection_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A seller must create their store page before listing (spec §32),
  -- and this FK is what lets PostgREST embed the seller profile on
  -- listing reads (market_seller_profiles' PK is organization_id).
  constraint market_listings_seller_profile_fk
    foreign key (organization_id)
    references public.market_seller_profiles(organization_id)
    on delete cascade
);

create index if not exists market_listings_browse_idx
  on public.market_listings (metro_slug, world_slug, status);
create index if not exists market_listings_org_idx
  on public.market_listings (organization_id);
create index if not exists market_listings_world_category_idx
  on public.market_listings (world_slug, category_slug)
  where status = 'published';

alter table public.market_listings enable row level security;

-- The marketplace is one public site: published listings are readable
-- by anyone (anon included). Drafts/paused/rejected are seller-only.
create policy market_listings_public_read on public.market_listings
  for select
  to anon, authenticated
  using (status = 'published');

create policy market_listings_org_read on public.market_listings
  for select
  to authenticated
  using (organization_id in (select public.get_user_org_ids()));

create policy market_listings_org_write on public.market_listings
  for all
  to authenticated
  using (public.user_has_org_role(organization_id, array['owner','admin']))
  with check (public.user_has_org_role(organization_id, array['owner','admin']));

-- ── World waitlist (smoke-test demand capture, spec §31) ─────────────
create table if not exists public.market_world_waitlist (
  id uuid primary key default gen_random_uuid(),
  world_slug text not null,
  metro_slug text not null default 'dmv',
  email text not null check (char_length(email) <= 320),
  created_at timestamptz not null default now()
);

create unique index if not exists market_world_waitlist_dedupe_idx
  on public.market_world_waitlist (world_slug, metro_slug, lower(email));

-- Service-role only: RLS on with no policies. Writes go through the
-- rate-limited server action using the admin client; emails are PII
-- and must never be client-readable.
alter table public.market_world_waitlist enable row level security;

-- ── Demand events (graduation-gate metrics, spec §31) ────────────────
create table if not exists public.market_demand_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in
    ('search','world_view','category_view','listing_view','waitlist_join','prelist_created')),
  world_slug text,
  category_slug text,
  metro_slug text not null default 'dmv',
  query text check (char_length(query) <= 200),
  listing_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists market_demand_events_gate_idx
  on public.market_demand_events (metro_slug, world_slug, kind, created_at);

-- Service-role only, same rationale as the waitlist.
alter table public.market_demand_events enable row level security;

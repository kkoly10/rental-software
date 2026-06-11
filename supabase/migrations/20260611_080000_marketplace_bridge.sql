-- Marketplace M6 (slice 3) — §27 operator bridge: outbox/inbox with
-- idempotent fulfillment projections.
--
-- The marketplace owns the commercial lifecycle and EMITS events to
-- the outbox; a cron consumer projects them into
-- market_fulfillment_projections, which the operator app reads on its
-- own surfaces. No synchronous coupling: a broken consumer delays
-- projections but never blocks a booking; replay is idempotent
-- (projection PK = booking_id).

create table if not exists public.market_bridge_outbox (
  id bigint generated always as identity primary key,
  event text not null check (event in
    ('marketplace.booking.confirmed','marketplace.booking.cancelled','marketplace.booking.completed')),
  booking_id uuid not null references public.market_bookings(id) on delete cascade,
  organization_id uuid not null,
  payload jsonb,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists market_bridge_outbox_pending_idx
  on public.market_bridge_outbox (id)
  where consumed_at is null;

alter table public.market_bridge_outbox enable row level security;
-- Service-role only (no policies): the bridge is system plumbing.

create table if not exists public.market_fulfillment_projections (
  booking_id uuid primary key references public.market_bookings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  listing_title text not null,
  quantity integer not null default 1,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- §14 buffers resolved into concrete prep/recovery clock times so
  -- the operator surface needs zero marketplace logic to render them.
  prep_at timestamptz not null,
  recovery_until timestamptz not null,
  status text not null default 'active' check (status in ('active','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_fulfillment_org_idx
  on public.market_fulfillment_projections (organization_id, status, prep_at);

alter table public.market_fulfillment_projections enable row level security;
-- The operator app reads projections with the signed-in user's client.
create policy market_fulfillment_org_read on public.market_fulfillment_projections
  for select to authenticated
  using (organization_id in (select public.get_user_org_ids()));

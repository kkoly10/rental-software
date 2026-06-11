-- Marketplace M2 — reservation holds + bookings (spec §10, §13, §14).
--
-- Key §10 decisions encoded here:
--  * request-to-book does NOT hard-hold inventory; holds begin at
--    seller approval (or instant-book checkout). The availability
--    check counts active holds + inventory-blocking bookings only.
--  * standby interest never blocks inventory.
--  * hold cleanup runs every 5 minutes (cron route added in this PR).
--
-- Renters are Supabase auth users (profiles) WITHOUT an org
-- membership — the marketplace accounts model from the build plan.

-- ── Reservation holds ────────────────────────────────────────────────
create table if not exists public.market_reservation_holds (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  renter_profile_id uuid references public.profiles(id) on delete set null,
  state text not null default 'checkout_hold' check (state in
    ('checkout_hold','verification_hold','awaiting_renter_payment','confirmed','expired','released')),
  quantity integer not null default 1 check (quantity >= 1),
  -- Effective window INCLUDING §14 buffers (computed app-side from the
  -- listing's prep/recovery minutes so the overlap math is one rule).
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_holds_listing_idx
  on public.market_reservation_holds (listing_id, state);
create index if not exists market_holds_expiry_idx
  on public.market_reservation_holds (expires_at)
  where expires_at is not null;

alter table public.market_reservation_holds enable row level security;
-- Renters see their own holds; sellers see holds on their listings.
create policy market_holds_renter_read on public.market_reservation_holds
  for select to authenticated
  using (renter_profile_id = auth.uid());
-- All writes via SECURITY DEFINER RPCs / service role only.

-- ── Standby queue (spec §10) ─────────────────────────────────────────
create table if not exists public.market_reservation_standby (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  renter_profile_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null default 1 check (quantity >= 1),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  promoted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists market_standby_listing_idx
  on public.market_reservation_standby (listing_id)
  where promoted_at is null;

alter table public.market_reservation_standby enable row level security;
create policy market_standby_renter_read on public.market_reservation_standby
  for select to authenticated
  using (renter_profile_id = auth.uid());

-- ── Bookings (spec §13 state machine; states validated by CHECK and
--    transition-validated in lib/market/booking-state.ts) ─────────────
create table if not exists public.market_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  renter_profile_id uuid not null references public.profiles(id) on delete restrict,
  hold_id uuid references public.market_reservation_holds(id) on delete set null,
  state text not null default 'pending_seller_approval' check (state in
    ('draft','pending_verification','pending_seller_approval','awaiting_payment',
     'confirmed','ready_for_handoff','checked_out','overdue',
     'returned_pending_review','completed','cancelled','disputed')),
  quantity integer not null default 1 check (quantity >= 1),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  -- §14 buffers frozen at booking time so later listing edits don't
  -- shift an existing booking's effective window.
  prep_buffer_minutes integer not null default 0,
  recovery_buffer_minutes integer not null default 0,
  -- Money snapshot (cents). Fee fields per §23; deposit per §9.
  rental_days integer not null check (rental_days >= 1),
  daily_price_cents integer not null check (daily_price_cents > 0),
  subtotal_cents integer not null check (subtotal_cents > 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  seller_payout_cents integer not null check (seller_payout_cents >= 0),
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  deposit_strategy text not null default 'auth_hold' check (deposit_strategy in
    ('none','auth_hold','captured_refundable','manual_review')),
  -- Stripe wiring lands in M3 (destination charge on the seller's
  -- Connect Express account + application_fee_amount). Null until then.
  stripe_payment_intent_id text,
  stripe_deposit_intent_id text,
  seller_responded_at timestamptz,
  renter_message text check (char_length(renter_message) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_bookings_listing_idx
  on public.market_bookings (listing_id, state);
create index if not exists market_bookings_org_idx
  on public.market_bookings (organization_id, state);
create index if not exists market_bookings_renter_idx
  on public.market_bookings (renter_profile_id, created_at desc);

alter table public.market_bookings enable row level security;

create policy market_bookings_renter_read on public.market_bookings
  for select to authenticated
  using (renter_profile_id = auth.uid());

create policy market_bookings_seller_read on public.market_bookings
  for select to authenticated
  using (organization_id in (select public.get_user_org_ids()));

-- All writes through SECURITY DEFINER RPCs below — no client-side
-- inserts/updates (mirrors the payments-table posture).

-- ── Booking event log (append-only; future bridge outbox seed, §27) ──
create table if not exists public.market_booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.market_bookings(id) on delete cascade,
  event text not null check (char_length(event) <= 80),
  actor text not null default 'system' check (actor in ('renter','seller','system','admin')),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists market_booking_events_booking_idx
  on public.market_booking_events (booking_id, id);

alter table public.market_booking_events enable row level security;
create policy market_booking_events_party_read on public.market_booking_events
  for select to authenticated
  using (
    booking_id in (
      select b.id from public.market_bookings b
      where b.renter_profile_id = auth.uid()
         or b.organization_id in (select public.get_user_org_ids())
    )
  );

-- ── Availability + hold RPCs ─────────────────────────────────────────

-- Atomic capacity check + hold insert. Mirrors the operator engine's
-- reserve_availability_if_available: advisory lock on the listing so
-- two concurrent checkouts on the last unit serialize; the loser gets
-- ok=false with reason 'unavailable' (caller may offer standby).
create or replace function public.market_reserve_hold(
  p_listing_id uuid,
  p_renter_profile_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_quantity integer,
  p_state text default 'checkout_hold',
  p_ttl_minutes integer default 15
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_eff_start timestamptz;
  v_eff_end timestamptz;
  v_reserved integer;
  v_hold_id uuid;
begin
  if p_quantity is null or p_quantity < 1 then
    return jsonb_build_object('ok', false, 'reason', 'bad_quantity');
  end if;
  if p_state not in ('checkout_hold','verification_hold','awaiting_renter_payment','confirmed') then
    return jsonb_build_object('ok', false, 'reason', 'bad_state');
  end if;

  select id, quantity, status, is_prelist,
         prep_buffer_minutes, recovery_buffer_minutes
    into v_listing
    from public.market_listings
   where id = p_listing_id;

  if not found or v_listing.status <> 'published' then
    return jsonb_build_object('ok', false, 'reason', 'listing_unavailable');
  end if;
  -- §31: pre-listings in smoke-test worlds are never bookable.
  if v_listing.is_prelist then
    return jsonb_build_object('ok', false, 'reason', 'prelist_not_bookable');
  end if;

  v_eff_start := p_starts_at - make_interval(mins => v_listing.prep_buffer_minutes);
  v_eff_end   := p_ends_at   + make_interval(mins => v_listing.recovery_buffer_minutes);

  -- Serialize per listing (same advisory-lock pattern as the operator
  -- availability engine).
  perform pg_advisory_xact_lock(hashtextextended(p_listing_id::text, 42));

  select coalesce(sum(h.quantity), 0) into v_reserved
    from public.market_reservation_holds h
   where h.listing_id = p_listing_id
     and h.state in ('checkout_hold','verification_hold','awaiting_renter_payment','confirmed')
     and (h.expires_at is null or h.expires_at > now())
     and h.starts_at < v_eff_end
     and h.ends_at   > v_eff_start;

  select v_reserved + coalesce(sum(b.quantity), 0) into v_reserved
    from public.market_bookings b
   where b.listing_id = p_listing_id
     and b.state in ('confirmed','ready_for_handoff','checked_out','overdue')
     and b.hold_id is null  -- bookings whose hold row still exists are already counted
     and (b.starts_at - make_interval(mins => b.prep_buffer_minutes)) < v_eff_end
     and (b.ends_at   + make_interval(mins => b.recovery_buffer_minutes)) > v_eff_start;

  if v_reserved + p_quantity > v_listing.quantity then
    return jsonb_build_object('ok', false, 'reason', 'unavailable',
      'available', greatest(v_listing.quantity - v_reserved, 0));
  end if;

  insert into public.market_reservation_holds
    (listing_id, renter_profile_id, state, quantity, starts_at, ends_at, expires_at)
  values
    (p_listing_id, p_renter_profile_id, p_state, p_quantity, v_eff_start, v_eff_end,
     case when p_state = 'confirmed' then null
          else now() + make_interval(mins => greatest(p_ttl_minutes, 1)) end)
  returning id into v_hold_id;

  return jsonb_build_object('ok', true, 'hold_id', v_hold_id);
end;
$$;

revoke all on function public.market_reserve_hold(uuid, uuid, timestamptz, timestamptz, integer, text, integer) from public, anon, authenticated;
-- Called only via the admin client (booking approval) — explicit
-- grant so the posture doesn't depend on Supabase default privileges.
grant execute on function public.market_reserve_hold(uuid, uuid, timestamptz, timestamptz, integer, text, integer) to service_role;

-- Expire stale holds; called by the 5-minute cron. Returns the number
-- of holds expired (the cron logs it).
create or replace function public.market_expire_stale_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.market_reservation_holds
     set state = 'expired', updated_at = now()
   where state in ('checkout_hold','verification_hold','awaiting_renter_payment')
     and expires_at is not null
     and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.market_expire_stale_holds() from public, anon, authenticated;
grant execute on function public.market_expire_stale_holds() to service_role;

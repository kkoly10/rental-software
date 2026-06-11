-- Roadmap item 5 (master plan §13): same-seller multi-item bookings.
-- Research-locked: no cart — "add more from this seller" produces ONE
-- booking with line items; all-or-nothing availability; whole-booking
-- accept/decline; one order-level deposit; one payment; booking-level
-- dispute with item-level evidence notes.
--
-- Back-compat: bookings.listing_id/daily_price_cents stay the PRIMARY
-- item; money totals stay on the booking. Items (including the
-- primary) get rows here. Legacy single-item bookings simply have no
-- rows and every reader falls back to the booking columns.

create table if not exists public.market_booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.market_bookings(id) on delete cascade,
  listing_id uuid not null references public.market_listings(id) on delete restrict,
  hold_id uuid references public.market_reservation_holds(id) on delete set null,
  quantity integer not null check (quantity >= 1),
  daily_price_cents integer not null check (daily_price_cents > 0),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  title_snapshot text not null,
  created_at timestamptz not null default now()
);

create index if not exists market_booking_items_booking_idx
  on public.market_booking_items (booking_id);
create index if not exists market_booking_items_listing_idx
  on public.market_booking_items (listing_id);

alter table public.market_booking_items enable row level security;
create policy market_booking_items_party_read on public.market_booking_items
  for select to authenticated
  using (
    booking_id in (
      select b.id from public.market_bookings b
      where b.renter_profile_id = auth.uid()
         or b.organization_id in (select public.get_user_org_ids())
    )
  );

-- ── Capacity: count blocking ITEM rows whose hold isn't active ──────
-- (mirrors the #17 fix for primary listings; without this, a
-- secondary item whose hold lapsed would stop blocking inventory).
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
  if v_listing.is_prelist then
    return jsonb_build_object('ok', false, 'reason', 'prelist_not_bookable');
  end if;

  v_eff_start := p_starts_at - make_interval(mins => v_listing.prep_buffer_minutes);
  v_eff_end   := p_ends_at   + make_interval(mins => v_listing.recovery_buffer_minutes);

  perform pg_advisory_xact_lock(hashtextextended(p_listing_id::text, 42));

  -- Active holds in the window (covers per-item holds too).
  select coalesce(sum(h.quantity), 0) into v_reserved
    from public.market_reservation_holds h
   where h.listing_id = p_listing_id
     and h.state in ('checkout_hold','verification_hold','awaiting_renter_payment','confirmed')
     and (h.expires_at is null or h.expires_at > now())
     and h.starts_at < v_eff_end
     and h.ends_at   > v_eff_start;

  -- Blocking PRIMARY bookings without an active hold (#17 fix).
  select v_reserved + coalesce(sum(b.quantity), 0) into v_reserved
    from public.market_bookings b
   where b.listing_id = p_listing_id
     and b.state in ('confirmed','ready_for_handoff','checked_out','overdue')
     and not exists (
       select 1 from public.market_reservation_holds h2
        where h2.id = b.hold_id
          and h2.state in ('checkout_hold','verification_hold','awaiting_renter_payment','confirmed')
          and (h2.expires_at is null or h2.expires_at > now())
     )
     and (b.starts_at - make_interval(mins => b.prep_buffer_minutes)) < v_eff_end
     and (b.ends_at   + make_interval(mins => b.recovery_buffer_minutes)) > v_eff_start;

  -- Blocking ITEM rows (secondary listings) without an active hold.
  select v_reserved + coalesce(sum(bi.quantity), 0) into v_reserved
    from public.market_booking_items bi
    join public.market_bookings b on b.id = bi.booking_id
   where bi.listing_id = p_listing_id
     and b.listing_id <> p_listing_id  -- primary already counted above
     and b.state in ('confirmed','ready_for_handoff','checked_out','overdue')
     and not exists (
       select 1 from public.market_reservation_holds h3
        where h3.id = bi.hold_id
          and h3.state in ('checkout_hold','verification_hold','awaiting_renter_payment','confirmed')
          and (h3.expires_at is null or h3.expires_at > now())
     )
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
grant execute on function public.market_reserve_hold(uuid, uuid, timestamptz, timestamptz, integer, text, integer) to service_role;

-- ── All-or-nothing multi-listing reserve ─────────────────────────────
-- Items as jsonb [{listing_id, quantity}, …]; locks listings in sorted
-- order (deadlock-free), reserves each via the single-listing logic,
-- and rolls back everything if ANY item is unavailable.
create or replace function public.market_reserve_holds_multi(
  p_items jsonb,
  p_renter_profile_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_state text default 'checkout_hold',
  p_ttl_minutes integer default 15
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_result jsonb;
  v_holds jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) < 1 then
    return jsonb_build_object('ok', false, 'reason', 'no_items');
  end if;

  for v_item in
    select (e->>'listing_id')::uuid as listing_id, (e->>'quantity')::integer as quantity
      from jsonb_array_elements(p_items) e
     order by (e->>'listing_id')::uuid
  loop
    v_result := public.market_reserve_hold(
      v_item.listing_id, p_renter_profile_id, p_starts_at, p_ends_at,
      v_item.quantity, p_state, p_ttl_minutes);
    if not (v_result->>'ok')::boolean then
      -- Abort the whole transaction: no partial holds survive.
      raise exception 'MARKET_MULTI_UNAVAILABLE %', v_result->>'reason'
        using errcode = 'P0001';
    end if;
    v_holds := v_holds || jsonb_build_object(
      'listing_id', v_item.listing_id, 'hold_id', v_result->>'hold_id');
  end loop;

  return jsonb_build_object('ok', true, 'holds', v_holds);
end;
$$;

revoke all on function public.market_reserve_holds_multi(jsonb, uuid, timestamptz, timestamptz, text, integer) from public, anon, authenticated;
grant execute on function public.market_reserve_holds_multi(jsonb, uuid, timestamptz, timestamptz, text, integer) to service_role;

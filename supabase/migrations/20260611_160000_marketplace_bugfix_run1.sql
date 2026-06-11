-- Bug-hunt Run 1 fixes (docs/qa/marketplace-bug-hunt.md).

-- #8/#9: transient CAS states so a deposit capture (dispute) and a
-- claim-window release (cron) can never both act on the same intent.
alter table public.market_bookings
  drop constraint if exists market_bookings_deposit_status_check;
alter table public.market_bookings
  add constraint market_bookings_deposit_status_check
  check (deposit_status in
    ('none','scheduled','held','releasing','capturing','released','captured','failed'));

-- #51: follow-up notes + "would rent again" are PLATFORM-ONLY signals.
-- The old policy let BOTH booking parties read each other's private
-- rows. Restrict authenticated reads to the row the user authored;
-- admins read via the service-role client (no policy needed).
drop policy if exists market_followups_own_read on public.market_followups;
create policy market_followups_author_read on public.market_followups
  for select to authenticated
  using (
    (party = 'renter' and booking_id in (
      select b.id from public.market_bookings b where b.renter_profile_id = auth.uid()
    ))
    or
    (party = 'seller' and booking_id in (
      select b.id from public.market_bookings b
      where b.organization_id in (select public.get_user_org_ids())
    ))
  );

-- #17: double-booking via the `hold_id is null` capacity predicate.
-- An inventory-blocking booking whose hold row is no longer active
-- (released/expired) but whose hold_id is non-null was counted by
-- NEITHER the holds query nor the bookings query. Recount bookings by
-- whether they have a CURRENTLY-ACTIVE hold, not by hold_id null-ness.
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

  -- Active holds in the window.
  select coalesce(sum(h.quantity), 0) into v_reserved
    from public.market_reservation_holds h
   where h.listing_id = p_listing_id
     and h.state in ('checkout_hold','verification_hold','awaiting_renter_payment','confirmed')
     and (h.expires_at is null or h.expires_at > now())
     and h.starts_at < v_eff_end
     and h.ends_at   > v_eff_start;

  -- Inventory-blocking bookings whose hold is NOT currently active
  -- (covers null hold_id AND released/expired holds). Prevents the
  -- double-booking hole.
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

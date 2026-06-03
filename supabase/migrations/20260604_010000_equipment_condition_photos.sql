-- Sprint 5.5 — Before/After equipment photos
--
-- The delivery side is already wired (proof_photo_url +
-- signature_name on route_stops, populated via the
-- crew_attach_proof_photo / crew_attach_signature RPCs from
-- migration 20260602_050000). This migration mirrors the same
-- pattern for the pickup side so the crew can capture a matching
-- "after" photo when collecting the equipment.
--
-- Design rationale: the operator's order detail page surfaces both
-- photos side-by-side as an "Equipment condition" card, and the
-- customer portal mirrors the same view. Photos are optional but
-- encouraged — the strategic value is having *something* on file,
-- not forensic-grade evidence.
--
-- See docs/architecture/equipment-condition-photos.md for the full
-- design rationale and the explicit non-goals (no per-item granularity
-- in v1, no damage codes, no EXIF chain, no annotation tooling).

alter table public.route_stops
  add column if not exists pickup_photo_url text,
  add column if not exists pickup_signature_name text;

comment on column public.route_stops.pickup_photo_url is
  'Sprint 5.5 — photo captured at pickup completion (the "after" half of the before/after pair). NULL when the crew skipped capture. Stored as a public URL pointing into the org''s uploads bucket.';
comment on column public.route_stops.pickup_signature_name is
  'Sprint 5.5 — customer''s signed name at pickup completion. NULL when the crew skipped signature capture. Acknowledges equipment condition at pickup.';

-- Atomic pickup-side proof RPCs — mirror crew_attach_proof_photo and
-- crew_attach_signature exactly so the TOCTOU guarantees are
-- preserved. A dispatcher reassignment between auth check and UPDATE
-- can't let an unassigned crew member's pickup photo land on the
-- wrong route.

create or replace function public.crew_attach_pickup_photo(
  p_stop_id   uuid,
  p_org_id    uuid,
  p_user_id   uuid,
  p_photo_url text
) returns table (ok boolean, reason text) language plpgsql security definer as $$
declare
  v_role text;
  v_route record;
begin
  select role into v_role
    from public.organization_memberships
   where organization_id = p_org_id
     and profile_id      = p_user_id
     and status          = 'active'
   limit 1;

  if v_role is null or v_role not in ('owner','admin','dispatcher','crew') then
    return query select false, 'not_authorized'::text;
    return;
  end if;

  select r.organization_id, r.assigned_driver_profile_id
    into v_route
    from public.route_stops s
    join public.routes r on r.id = s.route_id
   where s.id = p_stop_id
   for update of r;

  if v_route is null or v_route.organization_id <> p_org_id then
    return query select false, 'not_found'::text;
    return;
  end if;

  if v_role = 'crew' and v_route.assigned_driver_profile_id is distinct from p_user_id then
    return query select false, 'not_assigned'::text;
    return;
  end if;

  update public.route_stops
     set pickup_photo_url = p_photo_url
   where id = p_stop_id;

  return query select true, null::text;
end;
$$;

revoke all on function public.crew_attach_pickup_photo(uuid, uuid, uuid, text) from public;
grant execute on function public.crew_attach_pickup_photo(uuid, uuid, uuid, text) to authenticated;
comment on function public.crew_attach_pickup_photo(uuid, uuid, uuid, text) is
  'Sprint 5.5 — atomic assignment-check + pickup_photo_url update on a route stop. Mirrors crew_attach_proof_photo for the delivery side.';

create or replace function public.crew_attach_pickup_signature(
  p_stop_id     uuid,
  p_org_id      uuid,
  p_user_id     uuid,
  p_signer_name text
) returns table (ok boolean, reason text) language plpgsql security definer as $$
declare
  v_role text;
  v_route record;
begin
  select role into v_role
    from public.organization_memberships
   where organization_id = p_org_id
     and profile_id      = p_user_id
     and status          = 'active'
   limit 1;

  if v_role is null or v_role not in ('owner','admin','dispatcher','crew') then
    return query select false, 'not_authorized'::text;
    return;
  end if;

  select r.organization_id, r.assigned_driver_profile_id
    into v_route
    from public.route_stops s
    join public.routes r on r.id = s.route_id
   where s.id = p_stop_id
   for update of r;

  if v_route is null or v_route.organization_id <> p_org_id then
    return query select false, 'not_found'::text;
    return;
  end if;

  if v_role = 'crew' and v_route.assigned_driver_profile_id is distinct from p_user_id then
    return query select false, 'not_assigned'::text;
    return;
  end if;

  update public.route_stops
     set pickup_signature_name = p_signer_name
   where id = p_stop_id;

  return query select true, null::text;
end;
$$;

revoke all on function public.crew_attach_pickup_signature(uuid, uuid, uuid, text) from public;
grant execute on function public.crew_attach_pickup_signature(uuid, uuid, uuid, text) to authenticated;
comment on function public.crew_attach_pickup_signature(uuid, uuid, uuid, text) is
  'Sprint 5.5 — atomic assignment-check + pickup_signature_name update. Mirrors crew_attach_signature for the delivery side.';

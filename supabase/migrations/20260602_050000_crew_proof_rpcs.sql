-- security: atomic RPCs for proof photo + signature on crew stops
--
-- Mirrors the pattern from PR 12 / migration 20260602_030000_crew_stop_action_rpcs.
-- The proof-photo and signature endpoints in lib/crew/actions.ts had the
-- same TOCTOU shape that updateStopStatus did: SELECT the assignment,
-- branch on role in application code, UPDATE without re-checking. A
-- dispatcher reassignment between SELECT and UPDATE would let an
-- unassigned crew member still upload proof or save a signature on the
-- route.
--
-- These two RPCs collapse the check + UPDATE into one transaction with
-- a FOR UPDATE row lock on the parent route.

create or replace function public.crew_attach_proof_photo(
  p_stop_id  uuid,
  p_org_id   uuid,
  p_user_id  uuid,
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
     set proof_photo_url = p_photo_url
   where id = p_stop_id;

  return query select true, null::text;
end;
$$;

revoke all on function public.crew_attach_proof_photo(uuid, uuid, uuid, text) from public;
grant execute on function public.crew_attach_proof_photo(uuid, uuid, uuid, text) to authenticated;
comment on function public.crew_attach_proof_photo(uuid, uuid, uuid, text) is
  'Atomic assignment-check + proof_photo_url update on a route stop.';

create or replace function public.crew_attach_signature(
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
     set signature_name = p_signer_name
   where id = p_stop_id;

  return query select true, null::text;
end;
$$;

revoke all on function public.crew_attach_signature(uuid, uuid, uuid, text) from public;
grant execute on function public.crew_attach_signature(uuid, uuid, uuid, text) to authenticated;
comment on function public.crew_attach_signature(uuid, uuid, uuid, text) is
  'Atomic assignment-check + signature_name update on a route stop.';

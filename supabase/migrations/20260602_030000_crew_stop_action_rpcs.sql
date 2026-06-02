-- security: atomic crew-action RPCs that fold the assignment check
-- into the UPDATE so a TOCTOU window can't let a crew member finish a
-- stop on a route they were just unassigned from.
--
-- The application path was:
--   1. SELECT routes.assigned_driver_profile_id  (verify match)
--   2. UPDATE route_stops SET stop_status = ...  (no assignment check)
-- Between (1) and (2), a dispatcher could reassign the route and the
-- now-unassigned crew member would still complete the stop. These RPCs
-- collapse the window to zero by doing both inside one statement.
--
-- Authorization model:
--   - owner / admin / dispatcher: always allowed
--   - crew: only when routes.assigned_driver_profile_id = p_user_id
--   - viewer / unknown: denied
--
-- Org-isolation is enforced by joining on routes.organization_id =
-- p_org_id.

create or replace function public.crew_update_stop_status(
  p_stop_id    uuid,
  p_org_id     uuid,
  p_user_id    uuid,
  p_new_status text
) returns table (
  ok          boolean,
  reason      text,
  route_id    uuid,
  order_id    uuid,
  stop_type   text,
  prev_status text
) language plpgsql security definer as $$
declare
  v_role text;
  v_route record;
  v_updated record;
begin
  -- 1. Caller membership / role.
  select role into v_role
    from public.organization_memberships
   where organization_id = p_org_id
     and profile_id      = p_user_id
     and status          = 'active'
   limit 1;

  if v_role is null or v_role not in ('owner','admin','dispatcher','crew') then
    return query select false, 'not_authorized'::text, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  -- 2. Locate the stop's parent route under this org, taking a row
  --    lock so a concurrent route reassignment can't race the UPDATE
  --    that follows.
  select s.route_id,
         s.order_id,
         s.stop_type,
         s.stop_status as prev_status,
         r.organization_id,
         r.assigned_driver_profile_id
    into v_route
    from public.route_stops s
    join public.routes r on r.id = s.route_id
   where s.id = p_stop_id
   for update of r;

  if v_route is null or v_route.organization_id <> p_org_id then
    return query select false, 'not_found'::text, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  -- 3. Crew may only touch stops on routes they own. Owners / admins /
  --    dispatchers bypass this.
  if v_role = 'crew' and v_route.assigned_driver_profile_id is distinct from p_user_id then
    return query select false, 'not_assigned'::text, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  -- 4. Apply the status change.
  update public.route_stops s
     set stop_status  = p_new_status,
         completed_at = case when p_new_status = 'completed' then now() else s.completed_at end
   where s.id = p_stop_id
  returning s.route_id, s.order_id, s.stop_type, s.stop_status into v_updated;

  return query select
    true,
    null::text,
    v_updated.route_id,
    v_updated.order_id,
    v_updated.stop_type,
    v_route.prev_status;
end;
$$;

revoke all on function public.crew_update_stop_status(uuid, uuid, uuid, text) from public;
grant execute on function public.crew_update_stop_status(uuid, uuid, uuid, text) to authenticated;

comment on function public.crew_update_stop_status(uuid, uuid, uuid, text) is
  'Atomic assignment-check + stop status update. Closes a TOCTOU window where a crew member could complete a stop after being unassigned from the route.';

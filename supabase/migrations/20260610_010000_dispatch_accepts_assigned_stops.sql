-- QA Phase-2 walkthrough fix — Send Delivery never worked for
-- normally-attached stops.
--
-- dispatch_order_delivery's dispatchable-state guard only accepted
-- stop_status = 'pending', but 'pending' isn't a value the system
-- ever writes: the route_stops schema default is 'assigned'
-- (20260324_120000_initial_schema.sql:221) and the add_stop_to_route
-- RPC inserts 'assigned' (20260531_010000_add_stop_to_route_function.sql:63).
-- Every stop attached via the AssignToRouteCard or auto-attach
-- therefore bounced off the guard with 'invalid_state', and the
-- one-click dispatch button has been dead-on-arrival since it
-- shipped. The crew flow (assigned → en_route → completed) was the
-- only working dispatch path.
--
-- Accept 'assigned' as the dispatchable state. 'pending' is kept in
-- the allow-list defensively in case any pre-migration rows carry it.

create or replace function public.dispatch_order_delivery(
  p_order_id uuid,
  p_org_id   uuid,
  p_user_id  uuid
) returns table (
  ok        boolean,
  reason    text,
  stop_id   uuid,
  route_id  uuid
) language plpgsql security definer as $$
declare
  v_role text;
  v_stop record;
begin
  -- 1. Authorize the caller. Dispatcher and above can fire this.
  select role into v_role
    from public.organization_memberships
   where organization_id = p_org_id
     and profile_id      = p_user_id
     and status          = 'active'
   limit 1;

  if v_role is null or v_role not in ('owner','admin','dispatcher') then
    return query select false, 'not_authorized'::text, null::uuid, null::uuid;
    return;
  end if;

  -- 2. Find the order's route stop and lock the parent route. The
  --    FOR UPDATE prevents a concurrent route status change from
  --    racing the UPDATE below.
  select s.id            as stop_id,
         s.route_id,
         s.stop_status,
         s.stop_type,
         r.route_status,
         r.organization_id
    into v_stop
    from public.route_stops s
    join public.routes r on r.id = s.route_id
    join public.orders o on o.id = s.order_id
   where s.order_id      = p_order_id
     and o.organization_id = p_org_id
     and o.deleted_at is null
     and s.stop_type    = 'delivery'
   for update of r;

  if v_stop is null then
    return query select false, 'not_found'::text, null::uuid, null::uuid;
    return;
  end if;

  if v_stop.organization_id <> p_org_id then
    return query select false, 'not_found'::text, null::uuid, null::uuid;
    return;
  end if;

  if v_stop.stop_status = 'en_route' then
    return query select false, 'already_dispatched'::text, v_stop.stop_id, v_stop.route_id;
    return;
  end if;

  if v_stop.stop_status in ('completed', 'skipped') then
    -- Terminal states. Reachable if the operator hits the Send
    -- delivery button on an order that the crew already marked done
    -- on the mobile app, or that was completed by a previous
    -- dispatch + crew flow. Distinguishing this from
    -- already_dispatched lets the wrapper show a clearer message.
    return query select false, 'already_completed'::text, v_stop.stop_id, v_stop.route_id;
    return;
  end if;

  if v_stop.stop_status not in ('assigned', 'pending') then
    -- Any other unexpected state — refuse safely rather than
    -- forcing it into en_route from a state we haven't reasoned
    -- about. 'assigned' is the canonical fresh-stop state (schema
    -- default + add_stop_to_route); 'pending' is kept for any
    -- legacy rows that predate the standardisation.
    return query select false, 'invalid_state'::text, v_stop.stop_id, v_stop.route_id;
    return;
  end if;

  -- 3. Stop → en_route
  update public.route_stops
     set stop_status = 'en_route'
   where id = v_stop.stop_id;

  -- 4. Route → in_progress (idempotent for routes already in-flight)
  update public.routes
     set route_status = 'in_progress'
   where id = v_stop.route_id
     and route_status = 'planned';

  -- 5. Order → out_for_delivery (only from confirmed/scheduled). Any
  --    other prior status is left untouched; the dispatch was still
  --    valid from a routing perspective.
  update public.orders
     set order_status = 'out_for_delivery'
   where id = p_order_id
     and organization_id = p_org_id
     and order_status in ('confirmed', 'scheduled');

  return query select true, null::text, v_stop.stop_id, v_stop.route_id;
end;
$$;

revoke all on function public.dispatch_order_delivery(uuid, uuid, uuid) from public;
grant execute on function public.dispatch_order_delivery(uuid, uuid, uuid) to authenticated;

comment on function public.dispatch_order_delivery(uuid, uuid, uuid) is
  'Atomic one-click dispatch from the order detail page. Flips stop → en_route, route → in_progress, order → out_for_delivery in a single transaction so the three states stay in sync.';

-- Sprint 1.5 — Atomic dispatch RPC for the "Send delivery" button
--
-- One-click dispatch from the order detail page does three things that
-- must succeed or fail together:
--   1. Flip the stop status from 'pending' → 'en_route'
--   2. Flip the parent route from 'planned' → 'in_progress' (idempotent
--      if already in progress)
--   3. Flip the order from confirmed/scheduled → 'out_for_delivery'
--
-- If we did these as three separate app-layer updates we'd open windows
-- where the order shows as "out for delivery" but the stop is still
-- "pending", or where the operator pressed the button but a database
-- failure mid-way left the system in a confused intermediate state.
-- The RPC keeps all three atomic.
--
-- Authorization model (mirrors crew_update_stop_status):
--   - owner / admin / dispatcher: always allowed
--   - everyone else: denied with 'not_authorized'

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

  if v_stop.stop_status not in ('pending') then
    -- Already dispatched or in a terminal state — refuse politely so the
    -- caller can surface a "already underway" message instead of a 500.
    return query select false, 'already_dispatched'::text, v_stop.stop_id, v_stop.route_id;
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

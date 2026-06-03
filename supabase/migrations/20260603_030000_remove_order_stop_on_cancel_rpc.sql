-- Sprint 1.5 follow-up: atomic cancellation cleanup
--
-- The first cut of `removeOrderStopOnCancel` did three things in
-- separate Supabase calls: delete the stop, re-fetch remaining stops,
-- conditionally delete the route. Between the re-fetch and the route
-- delete, a concurrent auto-attach could insert a new stop on the
-- same route, and we'd then delete a route that has a stop on it. The
-- `route_status = 'planned'` filter limits blast radius but doesn't
-- eliminate the race.
--
-- This RPC collapses all three steps into one transaction with a row
-- lock on the parent route, mirroring the pattern used by
-- `crew_update_stop_status` and `dispatch_order_delivery`.
--
-- Authorization model: SECURITY DEFINER, but the function checks
-- `routes.organization_id = p_org_id` so callers can't poke at other
-- orgs' routes. The wrapper at lib/routes/remove-stop-on-cancel.ts
-- additionally verifies the caller's org via getOrgContext().

create or replace function public.remove_order_stop_on_cancel(
  p_order_id uuid,
  p_org_id   uuid
) returns table (
  ok            boolean,
  reason        text,
  removed       boolean,
  route_deleted boolean,
  route_id      uuid
) language plpgsql security definer as $$
declare
  v_stop record;
  v_remaining_count integer;
  v_route_deleted_count integer;
begin
  -- 1. Locate the stop and lock its parent route so a concurrent
  --    auto-attach can't slip a new stop in between our remove +
  --    cleanup steps.
  select s.id            as stop_id,
         s.route_id,
         r.route_status,
         r.organization_id
    into v_stop
    from public.route_stops s
    join public.routes r on r.id = s.route_id
   where s.order_id = p_order_id
   for update of r;

  if v_stop is null then
    -- No stop to remove — idempotent success. Most orders won't have
    -- a stop (cancellation can fire on inquiry-stage orders).
    return query select true, null::text, false, false, null::uuid;
    return;
  end if;

  if v_stop.organization_id <> p_org_id then
    return query select false, 'org_mismatch'::text, false, false, null::uuid;
    return;
  end if;

  -- 2. Delete the stop.
  delete from public.route_stops where id = v_stop.stop_id;

  -- 3. Re-sequence remaining stops to close the gap. Done inside the
  --    same transaction so a concurrent reader can't observe a gap.
  with renumbered as (
    select id,
           row_number() over (order by stop_sequence) as new_seq
      from public.route_stops
     where route_id = v_stop.route_id
  )
  update public.route_stops s
     set stop_sequence = renumbered.new_seq
    from renumbered
   where s.id = renumbered.id;

  -- 4. Count remaining stops on the route.
  select count(*) into v_remaining_count
    from public.route_stops
   where route_id = v_stop.route_id;

  -- 5. If the route is now empty AND still planned, delete it. Routes
  --    that already started (in_progress / completed) are preserved
  --    for audit history even when they end up empty.
  if v_remaining_count = 0 and v_stop.route_status = 'planned' then
    delete from public.routes
     where id = v_stop.route_id
       and organization_id = p_org_id
       and route_status = 'planned';
    get diagnostics v_route_deleted_count = row_count;
    return query select
      true,
      null::text,
      true,
      v_route_deleted_count > 0,
      v_stop.route_id;
  else
    return query select true, null::text, true, false, v_stop.route_id;
  end if;
end;
$$;

revoke all on function public.remove_order_stop_on_cancel(uuid, uuid) from public;
grant execute on function public.remove_order_stop_on_cancel(uuid, uuid) to authenticated;

comment on function public.remove_order_stop_on_cancel(uuid, uuid) is
  'Atomic cancellation cleanup. When an order is cancelled, removes its route stop, re-sequences remaining stops, and deletes the parent route if it was the last stop on a planned route. Holds a row lock on the parent route so concurrent auto-attach calls can''t race the cleanup.';

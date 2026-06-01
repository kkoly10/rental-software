-- Atomic add_stop_to_route function: removes the count+insert race in
-- lib/routes/auto-attach.ts and lib/routes/actions.ts addOrderToRoute.
--
-- Today both call sites:
--   1. SELECT count(*) FROM route_stops WHERE route_id = ?
--   2. INSERT INTO route_stops (..., stop_sequence = count + 1, ...)
-- Between (1) and (2), another request can do the same — both compute
-- nextSequence = N+1 and both try to insert.  The unique index on
-- (route_id, stop_sequence) added in 20260515_020000 catches it as a
-- conflict, but the operator just sees a generic Postgres error and
-- one of the two confirms fails silently from the user's perspective.
--
-- This function does the count + insert under a row-level lock on the
-- parent `routes` row so concurrent attaches serialise.  Each one reads
-- the live MAX, increments, inserts; the next one waits, reads the
-- already-updated MAX, increments from there.  No conflicts, no lost
-- writes.
--
-- SECURITY INVOKER (default) means the existing RLS policy on
-- route_stops still applies — the caller has to have permission to
-- write to this route_id or the insert is rejected.

create or replace function public.add_stop_to_route(
  p_route_id uuid,
  p_order_id uuid,
  p_stop_type text default 'delivery',
  p_scheduled_window_start timestamptz default null
)
returns public.route_stops
language plpgsql
as $$
declare
  v_next_sequence int;
  v_new_stop public.route_stops;
begin
  -- Lock the parent route row so any other inserter for this route
  -- waits until we commit.  If the route doesn't exist, FOR UPDATE on
  -- a missing row is a no-op (perform 1 returns zero rows), and the
  -- subsequent INSERT will fail the foreign key check with a clearer
  -- error than the function trying to detect it itself.
  perform 1 from public.routes where id = p_route_id for update;

  -- Compute the next sequence under the lock.  COALESCE handles the
  -- empty-route case where MAX returns null.
  select coalesce(max(stop_sequence), 0) + 1
  into v_next_sequence
  from public.route_stops
  where route_id = p_route_id;

  insert into public.route_stops (
    route_id,
    order_id,
    stop_type,
    stop_sequence,
    stop_status,
    scheduled_window_start
  )
  values (
    p_route_id,
    p_order_id,
    coalesce(p_stop_type, 'delivery'),
    v_next_sequence,
    'assigned',
    p_scheduled_window_start
  )
  returning * into v_new_stop;

  return v_new_stop;
end;
$$;

-- Grant execute to authenticated users so the Supabase client running
-- as the operator's session can call it.  RLS on route_stops still
-- gates the actual write.
grant execute on function public.add_stop_to_route(
  uuid, uuid, text, timestamptz
) to authenticated;

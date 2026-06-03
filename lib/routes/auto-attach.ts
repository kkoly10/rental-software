import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Result of an auto-attach attempt.  When `attached` is false the
 * `reason` is a stable string we can surface in logs and in the
 * updateOrderStatus response so the operator sees why the magic
 * didn't fire (or, more importantly, that it ran at all).
 */
export type AutoAttachResult =
  | {
      attached: true;
      routeId: string;
      routeName: string;
      /**
       * `created` is true when the auto-attach also had to create the
       * parent route (the auto-mode case where no route exists for
       * the order's date yet). Callers use this to decide whether to
       * surface "added to route X" vs "scheduled for {date}".
       */
      created: boolean;
    }
  | {
      attached: false;
      reason:
        | "disabled"
        | "order_not_found"
        | "no_event_date"
        | "no_address"
        | "no_route"
        | "ambiguous"
        | "route_completed"
        | "already_attached"
        | "insert_failed";
      detail?: string;
    };

/**
 * When an order transitions to `confirmed`, opportunistically attach
 * it to today's-for-that-date route. Behavior depends on the org's
 * `routing_mode`:
 *
 * **Auto mode** (the new Smart Delivery Mode default for new orgs):
 *   - If no route exists for the event_date, create one named
 *     "Deliveries for {date}" and add the order as the first stop.
 *   - If exactly one route exists, attach to it.
 *   - If multiple routes exist, defer to the operator (`ambiguous`).
 *   - After insert, stops are re-sequenced by `scheduled_window_start`
 *     so the loading order reflects the day's actual schedule.
 *
 * **Manual mode** (legacy behavior, preserved for orgs that already
 *  had routes at migration time, or that explicitly opted out):
 *   - Only auto-attaches when exactly one non-completed route already
 *     exists for that date. Never creates one.
 *
 * Common preconditions in both modes:
 *   - Order has an event_date and a delivery_line1
 *   - Order isn't already a stop on any route
 *
 * The order's event_date and delivery_line1 columns are the same
 * signals the Add Stop dropdown uses (see getOrdersForRouteDate);
 * keeping the logic in sync means the auto-attach can't surprise the
 * operator with a stop they wouldn't have been able to attach manually
 * anyway.
 *
 * Never throws — failures return a structured reason so the caller
 * (updateOrderStatus) can append to its response message.
 */
export async function autoAttachOrderToRouteIfEligible(
  organizationId: string,
  orderId: string,
  supabase: SupabaseClient,
): Promise<AutoAttachResult> {
  try {
    // 1) Org-level mode + legacy kill switch. The new `routing_mode`
    //    column is the source of truth post-migration; the legacy
    //    `settings.auto_route_on_confirm === false` flag still maps to
    //    'manual' for safety in case the migration left an org behind.
    const { data: org } = await supabase
      .from("organizations")
      .select("routing_mode, settings")
      .eq("id", organizationId)
      .maybeSingle();
    const mode =
      (org?.routing_mode as string | null) === "manual" ||
      (org?.settings as Record<string, unknown> | null)?.auto_route_on_confirm === false
        ? "manual"
        : "auto";

    // 2) Order prereqs.
    const { data: order } = await supabase
      .from("orders")
      .select("event_date, delivery_line1, event_start_time")
      .eq("id", orderId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!order) return { attached: false, reason: "order_not_found" };

    const eventDate = (order.event_date as string | null) ?? "";
    if (!eventDate) return { attached: false, reason: "no_event_date" };

    const hasAddress = !!((order.delivery_line1 as string | null) ?? "").trim();
    if (!hasAddress) return { attached: false, reason: "no_address" };

    // 3) Already on a route?  Don't double-route.
    const { data: existingStop } = await supabase
      .from("route_stops")
      .select("id")
      .eq("order_id", orderId)
      .limit(1)
      .maybeSingle();
    if (existingStop) return { attached: false, reason: "already_attached" };

    // 4) Find candidate routes for this org+date. Restrict to "planned"
    // so a route the driver has already started or finished doesn't
    // get a new stop bolted on mid-run. If the only candidate is in
    // progress, fall through to the no-route branch — auto mode will
    // create a fresh planned route alongside it, and manual mode will
    // return no_route so the operator can choose.
    const { data: routes } = await supabase
      .from("routes")
      .select("id, name, route_status")
      .eq("organization_id", organizationId)
      .eq("route_date", eventDate)
      .eq("route_status", "planned")
      .is("deleted_at", null);

    let targetRoute: { id: string; name: string; route_status: string } | null = null;
    let createdRoute = false;

    if (!routes || routes.length === 0) {
      // No route for this date yet.
      if (mode === "manual") {
        return { attached: false, reason: "no_route" };
      }
      // Auto mode: create the route the operator would have created.
      const formatted = formatRouteDate(eventDate);
      const { data: newRoute, error: createErr } = await supabase
        .from("routes")
        .insert({
          organization_id: organizationId,
          name: `Deliveries for ${formatted}`,
          route_date: eventDate,
          route_status: "planned",
        })
        .select("id, name, route_status")
        .single();
      if (createErr || !newRoute) {
        return {
          attached: false,
          reason: "insert_failed",
          detail: createErr?.message ?? "route create failed",
        };
      }
      targetRoute = newRoute as { id: string; name: string; route_status: string };
      createdRoute = true;
    } else if (routes.length === 1) {
      targetRoute = routes[0] as { id: string; name: string; route_status: string };
    } else {
      // Operator has more than one route for this date — defer to them
      // in either mode. The PR-B Add-to-Route card on the order detail
      // page will let them pick.
      return { attached: false, reason: "ambiguous" };
    }

    if (targetRoute.route_status === "completed") {
      return { attached: false, reason: "route_completed" };
    }

    // 5) Use the order's event_start_time as the stop's anchor so
    //    the auto-sequencing in step 7 can sort by it. event_start_time
    //    is a timestamptz already corrected for the org's IANA tz
    //    (see migration 20260602_060000_event_local_time.sql). Orders
    //    without a start time sort to the end of the day.
    const scheduledWindowStart =
      (order.event_start_time as string | null) ?? null;

    // 6) Insert via the locking RPC. Same call path as the manual
    //    Add Stop form so the (route_id, stop_sequence) unique index
    //    can't race with a concurrent attach.
    const { error } = await supabase.rpc("add_stop_to_route", {
      p_route_id: targetRoute.id,
      p_order_id: orderId,
      p_stop_type: "delivery",
      p_scheduled_window_start: scheduledWindowStart,
    });
    if (error) {
      return {
        attached: false,
        reason: "insert_failed",
        detail: error.message,
      };
    }

    // 7) Auto-sequence by scheduled time so the day's loading order
    //    reflects the actual delivery schedule, not the order the
    //    operator happened to confirm bookings. Stops with no time
    //    sort last (deterministic by stop id as a tiebreaker).
    await resequenceStopsByScheduledTime(supabase, targetRoute.id);

    return {
      attached: true,
      routeId: targetRoute.id,
      routeName: targetRoute.name ?? "",
      created: createdRoute,
    };
  } catch (err) {
    return {
      attached: false,
      reason: "insert_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function formatRouteDate(yyyyMmDd: string): string {
  try {
    return new Date(`${yyyyMmDd}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return yyyyMmDd;
  }
}

/**
 * Re-numbers `stop_sequence` for every stop on the route so that the
 * order matches the day's scheduled times. Stops missing a
 * scheduled_window_start sort to the end. Run after every auto-attach
 * insert so subsequent same-day adds slot into the right place
 * automatically.
 *
 * Implementation note: the (route_id, stop_sequence) unique index
 * means we can't bulk-update in one shot without temporarily
 * violating uniqueness. We update one row at a time, ascending — the
 * intermediate values stay unique because each update raises a
 * sequence that's currently in use to one above it (or unchanged).
 */
async function resequenceStopsByScheduledTime(
  supabase: SupabaseClient,
  routeId: string,
): Promise<void> {
  const { data: stops } = await supabase
    .from("route_stops")
    .select("id, scheduled_window_start, stop_sequence")
    .eq("route_id", routeId);

  if (!stops || stops.length === 0) return;

  const sorted = [...stops].sort((a, b) => {
    const aTime = (a as { scheduled_window_start: string | null }).scheduled_window_start;
    const bTime = (b as { scheduled_window_start: string | null }).scheduled_window_start;
    if (aTime && bTime) return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
    if (aTime) return -1;
    if (bTime) return 1;
    return (a.id as string) < (b.id as string) ? -1 : 1;
  });

  // First pass: park all existing rows at a high-numbered sequence
  // band so the second pass can write the final values without
  // colliding with the unique index. Using `1000 + index` keeps the
  // intermediate range disjoint from any plausible final value
  // (routes with 500+ stops would already be capped by limit elsewhere).
  await Promise.all(
    sorted.map((stop, idx) =>
      supabase
        .from("route_stops")
        .update({ stop_sequence: 1000 + idx + 1 })
        .eq("id", stop.id),
    ),
  );

  // Second pass: write the final sequence numbers in order.
  await Promise.all(
    sorted.map((stop, idx) =>
      supabase
        .from("route_stops")
        .update({ stop_sequence: idx + 1 })
        .eq("id", stop.id),
    ),
  );
}

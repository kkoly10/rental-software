import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Auto-remove an order's route stop when the order is cancelled or
 * refunded. Cleans up the zombie-route follow-on if that was the last
 * stop on a planned route.
 *
 * Applies in both auto AND manual mode — keeping a stop for a non-
 * event is bookkeeping garbage either way, and the count-vs-list
 * mismatch it creates (the route detail view filters cancelled-order
 * stops out at render time, but the count stays inflated) is a real
 * UX bug regardless of routing philosophy.
 *
 * Idempotent: a no-op when the order isn't on any route.
 *
 * Never throws — failures are returned for the caller to log. We do
 * NOT want a cancellation flow to block on this cleanup; the order is
 * already cancelled at the time we run.
 */
export async function removeOrderStopOnCancel(
  organizationId: string,
  orderId: string,
  supabase: SupabaseClient,
): Promise<
  | { ok: true; removed: boolean; routeDeleted: boolean }
  | { ok: false; reason: string; detail?: string }
> {
  try {
    // Find the stop (if any) and its parent route.
    const { data: stop } = await supabase
      .from("route_stops")
      .select(
        "id, route_id, routes!inner(id, organization_id, route_status)",
      )
      .eq("order_id", orderId)
      .maybeSingle();

    if (!stop) {
      return { ok: true, removed: false, routeDeleted: false };
    }

    const route = (stop as Record<string, unknown>).routes as {
      id: string;
      organization_id: string;
      route_status: string;
    } | null;

    // Defense in depth: make sure the stop's route lives in the same
    // org as the caller. Should be impossible to violate via legit
    // app flows since updateOrderStatus already verified the order
    // belongs to ctx.organizationId, but we don't want a future
    // refactor to make this assumption wrong.
    if (!route || route.organization_id !== organizationId) {
      return { ok: false, reason: "org_mismatch" };
    }

    const routeId = stop.route_id as string;

    // 1. Delete the stop.
    const { error: deleteErr } = await supabase
      .from("route_stops")
      .delete()
      .eq("id", stop.id)
      .eq("route_id", routeId);

    if (deleteErr) {
      return { ok: false, reason: "delete_failed", detail: deleteErr.message };
    }

    // 2. Re-sequence remaining stops to close the gap, mirroring the
    //    behavior of the manual removeStopFromRoute action.
    const { data: remaining } = await supabase
      .from("route_stops")
      .select("id, stop_sequence")
      .eq("route_id", routeId)
      .order("stop_sequence", { ascending: true });

    if (remaining && remaining.length > 0) {
      await Promise.all(
        remaining.map((s, idx) =>
          supabase
            .from("route_stops")
            .update({ stop_sequence: idx + 1 })
            .eq("id", s.id),
        ),
      );
      return { ok: true, removed: true, routeDeleted: false };
    }

    // 3. Last stop just got cancelled. Delete the route if it's still
    //    `planned` — matches the rule in removeStopFromRoute. Routes
    //    that already started (in_progress / completed) are preserved
    //    for audit history.
    const { error: routeDelErr, count } = await supabase
      .from("routes")
      .delete({ count: "exact" })
      .eq("id", routeId)
      .eq("organization_id", organizationId)
      .eq("route_status", "planned");

    if (routeDelErr) {
      return { ok: false, reason: "route_delete_failed", detail: routeDelErr.message };
    }

    return { ok: true, removed: true, routeDeleted: (count ?? 0) > 0 };
  } catch (err) {
    return {
      ok: false,
      reason: "exception",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Result of an auto-attach attempt.  When `attached` is false the
 * `reason` is a stable string we can surface in logs and in the
 * updateOrderStatus response so the operator sees why the magic
 * didn't fire (or, more importantly, that it ran at all).
 */
export type AutoAttachResult =
  | { attached: true; routeId: string; routeName: string }
  | {
      attached: false;
      reason:
        | "disabled"
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
 * it to today's-for-that-date route — but only when the situation is
 * unambiguous:
 *
 *   * org setting `auto_route_on_confirm` is not explicitly false
 *   * order has an event_date and a delivery_line1
 *   * exactly ONE non-completed route exists for that date
 *   * order isn't already a stop on any route
 *
 * The order's event_date and delivery_line1 columns are the same
 * signals the Add Stop dropdown uses (see getOrdersForRouteDate);
 * keeping the logic in sync means the auto-attach can't surprise
 * the operator with a stop they wouldn't have been able to attach
 * manually anyway.
 *
 * Side-effect: inserts one row into route_stops with stop_sequence
 * = current_count + 1, stop_status = 'assigned', stop_type =
 * 'delivery'.  The route detail page will re-render on its next
 * revalidate.
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
    // 1) Org-level kill switch.
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    const settings = (org?.settings as Record<string, unknown>) ?? {};
    if (settings.auto_route_on_confirm === false) {
      return { attached: false, reason: "disabled" };
    }

    // 2) Order prereqs.
    const { data: order } = await supabase
      .from("orders")
      .select("event_date, delivery_line1")
      .eq("id", orderId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!order) return { attached: false, reason: "no_event_date" };

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

    // 4) Find the unique candidate route.
    const { data: routes } = await supabase
      .from("routes")
      .select("id, name, status")
      .eq("organization_id", organizationId)
      .eq("route_date", eventDate)
      .is("deleted_at", null);

    if (!routes || routes.length === 0) {
      return { attached: false, reason: "no_route" };
    }
    if (routes.length > 1) {
      // Operator has more than one route for this date — defer to them.
      // The PR-B Add-to-Route card on the order detail page will let
      // them pick.
      return { attached: false, reason: "ambiguous" };
    }
    const route = routes[0];
    if (route.status === "completed") {
      return { attached: false, reason: "route_completed" };
    }

    // 5) Compute next sequence (match the manual Add Stop path).
    const { count: stopCount } = await supabase
      .from("route_stops")
      .select("*", { count: "exact", head: true })
      .eq("route_id", route.id);
    const nextSequence = (stopCount ?? 0) + 1;

    // 6) Insert the stop.
    const { error } = await supabase.from("route_stops").insert({
      route_id: route.id,
      order_id: orderId,
      stop_type: "delivery",
      stop_sequence: nextSequence,
      stop_status: "assigned",
      scheduled_window_start: null,
    });
    if (error) {
      return {
        attached: false,
        reason: "insert_failed",
        detail: error.message,
      };
    }

    return {
      attached: true,
      routeId: route.id as string,
      routeName: (route.name as string) ?? "Route",
    };
  } catch (err) {
    return {
      attached: false,
      reason: "insert_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

/**
 * Why the order can't be attached to a route right now (the same
 * prerequisites the Add Stop dropdown enforces, but checked from the
 * order side so the operator gets the same diagnosis without leaving
 * the order page). */
export type OrderRoutingBlocker =
  | "no_event_date"     // order has no event_date set
  | "not_confirmed"     // order_status is not confirmed/scheduled
  | "no_address";       // delivery_line1 missing

export type OrderRoutingState =
  | {
      kind: "blocked";
      reason: OrderRoutingBlocker;
      currentStatus: string;
    }
  | {
      kind: "already_assigned";
      eventDateRaw: string;
      routeId: string;
      routeName: string;
    }
  | {
      kind: "eligible";
      eventDateRaw: string;
      /** Routes on the same date as the order, that the order isn't on. */
      candidateRoutes: Array<{ id: string; name: string; routeStatus: string; stopCount: number }>;
    };

/**
 * Resolves the order's "where can I route this?" state in one call so
 * the order detail page can render the Add-to-Route card without
 * round-tripping through the deliveries page.
 *
 * Returns a discriminated union so the rendering side never has to
 * check three independent fields.
 */
export async function getOrderRoutingState(
  orderId: string
): Promise<OrderRoutingState | null> {
  if (!hasSupabaseEnv()) return null;

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createSupabaseServerClient();

  // Pull the prerequisites in a single round trip. Address lives on
  // customer_addresses, NOT on orders directly. The previous select
  // referenced orders.delivery_line1 which doesn't exist; PostgREST
  // silently returned it as null, so hasAddress was always false and
  // every order on the detail page showed "blocked: no_address" in
  // the AssignToRouteCard — even orders that had a perfectly valid
  // delivery_line1 in customer_addresses.
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_status, event_date, delivery_address_id, customer_addresses!delivery_address_id(line1)"
    )
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) return null;

  const eventDate = order.event_date as string | null;
  const status = (order.order_status as string) ?? "inquiry";
  const address = (order as Record<string, unknown>).customer_addresses as
    | { line1?: string | null }
    | null;
  const hasAddress = !!address?.line1?.trim();

  // Hard blockers first.
  if (!eventDate) {
    return { kind: "blocked", reason: "no_event_date", currentStatus: status };
  }
  if (!["confirmed", "scheduled"].includes(status)) {
    return { kind: "blocked", reason: "not_confirmed", currentStatus: status };
  }
  if (!hasAddress) {
    return { kind: "blocked", reason: "no_address", currentStatus: status };
  }

  // Already on a route? Stop here so the operator doesn't accidentally
  // double-route the same order. routes has no soft-delete column —
  // the previous deleted_at filter caused PostgREST to error out and
  // return null, so the AssignToRouteCard never noticed when an order
  // was already attached and showed "eligible" anyway.
  const { data: existingStop } = await supabase
    .from("route_stops")
    .select("route_id, routes!inner(id, name, organization_id, route_date)")
    .eq("order_id", orderId)
    .eq("routes.organization_id", ctx.organizationId)
    .limit(1)
    .maybeSingle();

  if (existingStop) {
    const r = (existingStop as Record<string, unknown>).routes as {
      id: string;
      name: string;
    } | null;
    if (r) {
      return {
        kind: "already_assigned",
        eventDateRaw: eventDate,
        routeId: r.id,
        routeName: r.name ?? "",
      };
    }
  }

  // Eligible — list routes for that date. We also report each route's
  // current stopCount so the card can hint at how loaded each one is.
  // Filter out completed routes — they can't accept new stops. The
  // routes table uses `route_status` (not `status`) and has no
  // soft-delete column; the old query referenced both, errored at
  // PostgREST, and returned an empty candidate list — meaning the
  // AssignToRouteCard always told operators "no routes for this date"
  // even when one existed.
  const { data: routes } = await supabase
    .from("routes")
    .select("id, name, route_status, route_stops(id)")
    .eq("organization_id", ctx.organizationId)
    .eq("route_date", eventDate)
    .neq("route_status", "completed")
    .order("created_at", { ascending: true });

  const candidateRoutes = (routes ?? []).map((r) => {
    const stops = (r as Record<string, unknown>).route_stops as
      | { id: string }[]
      | null;
    return {
      id: r.id as string,
      name: (r.name as string) ?? "",
      routeStatus: (r.route_status as string) ?? "planned",
      stopCount: stops?.length ?? 0,
    };
  });

  return { kind: "eligible", eventDateRaw: eventDate, candidateRoutes };
}

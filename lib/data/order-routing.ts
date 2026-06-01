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

  // Pull the prerequisites in a single round trip.
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_status, event_date, delivery_line1")
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) return null;

  const eventDate = order.event_date as string | null;
  const status = (order.order_status as string) ?? "inquiry";
  const hasAddress = !!(order.delivery_line1 as string | null)?.trim();

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

  // Already on a route?  Stop here so the operator doesn't accidentally
  // double-route the same order.  Scope to non-deleted routes only —
  // otherwise an order attached to a soft-deleted route would still
  // flag as "already assigned" with a dead View route → link.
  const { data: existingStop } = await supabase
    .from("route_stops")
    .select("route_id, routes!inner(id, name, organization_id, route_date, deleted_at)")
    .eq("order_id", orderId)
    .eq("routes.organization_id", ctx.organizationId)
    .is("routes.deleted_at", null)
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
        routeName: r.name ?? "Route",
      };
    }
  }

  // Eligible — list routes for that date.  We also report each route's
  // current stopCount so the card can hint at how loaded each one is.
  // Filter out completed routes — they can't accept new stops, and the
  // auto-attach helper (lib/routes/auto-attach.ts) already skips them,
  // so showing them here as candidates would let the operator click
  // "Attach" only to get a confusing server-side error.
  const { data: routes } = await supabase
    .from("routes")
    .select("id, name, status, route_stops(id)")
    .eq("organization_id", ctx.organizationId)
    .eq("route_date", eventDate)
    .is("deleted_at", null)
    .neq("status", "completed")
    .order("created_at", { ascending: true });

  const candidateRoutes = (routes ?? []).map((r) => {
    const stops = (r as Record<string, unknown>).route_stops as
      | { id: string }[]
      | null;
    return {
      id: r.id as string,
      name: (r.name as string) ?? "Route",
      routeStatus: (r.status as string) ?? "planned",
      stopCount: stops?.length ?? 0,
    };
  });

  return { kind: "eligible", eventDateRaw: eventDate, candidateRoutes };
}

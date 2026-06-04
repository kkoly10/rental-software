import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Detach a cancelled order from any open route stops. Called from
 * `updateOrderStatus` when an order transitions to `cancelled` (decision
 * 2.11). Completed and skipped stops stay in place — they're an audit
 * record of work the crew already did.
 *
 * Lives in its own module (not in `lib/routes/actions.ts`) so the node
 * test runner can exercise it without dragging in `next/cache`. Pure
 * helper: caller is responsible for calling `revalidatePath` after on the
 * returned route IDs.
 *
 * Scope: organization is enforced via the routes inner-join filter, so a
 * crafted orderId from another org can't bleed into this one's routing
 * data.
 */
export async function releaseRouteStopsForCancelledOrder(
  organizationId: string,
  orderId: string,
  supabase: SupabaseClient
): Promise<{ removedCount: number; affectedRouteIds: string[] }> {
  const { data: openStops } = await supabase
    .from("route_stops")
    .select("id, route_id, stop_status, routes!inner(organization_id)")
    .eq("order_id", orderId)
    .eq("routes.organization_id", organizationId)
    .not("stop_status", "in", "(completed,skipped)");

  if (!openStops || openStops.length === 0) {
    return { removedCount: 0, affectedRouteIds: [] };
  }

  const stopIds: string[] = openStops.map((s) => String(s.id));
  const affectedRouteIds: string[] = Array.from(
    new Set(openStops.map((s) => String(s.route_id)))
  );

  const { error: deleteError } = await supabase
    .from("route_stops")
    .delete()
    .in("id", stopIds);

  if (deleteError) {
    return { removedCount: 0, affectedRouteIds: [] };
  }

  return { removedCount: stopIds.length, affectedRouteIds };
}

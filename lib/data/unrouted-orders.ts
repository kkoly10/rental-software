import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type UnroutedOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  eventDate: string;
  status: string;
  productName: string;
};

/**
 * Reason an order for the route's date is *not* eligible to attach as a
 * stop.  Surfaced verbatim to the operator so the empty state of the
 * Add Stop dropdown stops being a dead end.
 */
export type BlockReason =
  | "not_confirmed"   // order_status is inquiry/quote_sent/awaiting_deposit
  | "no_address"      // delivery_line1 missing — geocoding can't even start
  | "on_other_route"; // operator already routed it elsewhere for the same day

export type BlockedOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  productName: string;
  reason: BlockReason;
  currentStatus: string;
};

export type OrdersForRouteDate = {
  eligible: UnroutedOrder[];
  blocked: BlockedOrder[];
  /** Total orders for the date that are not on the current route. */
  totalForDate: number;
};

export async function getUnroutedOrdersForDate(
  routeDate: string
): Promise<UnroutedOrder[]> {
  if (!hasSupabaseEnv()) return [];

  const ctx = await getOrgContext();
  if (!ctx) return [];

  const supabase = await createSupabaseServerClient();

  // Orders already on a route for this date
  const { data: routedStops } = await supabase
    .from("route_stops")
    .select("order_id, routes!inner(route_date, organization_id)")
    .eq("routes.route_date", routeDate)
    .eq("routes.organization_id", ctx.organizationId)
    // Bound explicitly so we don't silently use the default 1000-row cap to
    // build the exclusion set.
    .limit(2000);

  const routedOrderIds = new Set((routedStops ?? []).map((s) => s.order_id));

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, order_status, event_date, customers(first_name, last_name), order_items(item_name_snapshot)")
    .eq("organization_id", ctx.organizationId)
    .eq("event_date", routeDate)
    .is("deleted_at", null)
    .in("order_status", ["confirmed", "scheduled"])
    .order("created_at", { ascending: true });

  if (!orders) return [];

  return orders
    .filter((o) => !routedOrderIds.has(o.id))
    .map((o) => {
      const customer = (o as Record<string, unknown>).customers as { first_name?: string; last_name?: string } | null;
      const items = (o as Record<string, unknown>).order_items as { item_name_snapshot?: string }[] | null;
      return {
        id: o.id,
        orderNumber: o.order_number ?? "",
        customerName: [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "",
        eventDate: o.event_date ?? routeDate,
        status: o.order_status ?? "confirmed",
        productName: items?.[0]?.item_name_snapshot ?? "",
      };
    });
}

/**
 * Like getUnroutedOrdersForDate but also reports orders that *exist* for
 * this date yet aren't eligible to attach, with a concrete reason per
 * order.  Used by the Add Stop form's empty-state to tell the operator
 * exactly what needs fixing instead of "No confirmed orders without a
 * route for this date."
 */
export async function getOrdersForRouteDate(
  routeDate: string,
  currentRouteId: string,
): Promise<OrdersForRouteDate> {
  if (!hasSupabaseEnv()) return { eligible: [], blocked: [], totalForDate: 0 };

  const ctx = await getOrgContext();
  if (!ctx) return { eligible: [], blocked: [], totalForDate: 0 };

  const supabase = await createSupabaseServerClient();

  // Partition orders already routed for this date into "this route" vs
  // "some other route" in one round trip so we can give each blocked
  // order the right reason.
  const { data: routedStops } = await supabase
    .from("route_stops")
    .select("order_id, route_id, routes!inner(route_date, organization_id)")
    .eq("routes.route_date", routeDate)
    .eq("routes.organization_id", ctx.organizationId)
    .limit(2000);

  const onCurrentRoute = new Set<string>();
  const onOtherRoute = new Set<string>();
  for (const s of routedStops ?? []) {
    const orderId = s.order_id as string | null;
    const routeId = s.route_id as string | null;
    if (!orderId) continue;
    if (routeId === currentRouteId) onCurrentRoute.add(orderId);
    else onOtherRoute.add(orderId);
  }

  // Fetch ALL orders for the date (no status filter) so we can classify
  // why each one isn't currently a candidate. Address lives on the
  // joined customer_addresses row, NOT on orders directly — the old
  // select referenced a non-existent orders.delivery_line1 column,
  // which PostgREST silently returned as null, sending every
  // confirmed-and-addressed order into the "no_address" bucket and
  // emptying the Add Stop dropdown for every operator.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, order_status, event_date, delivery_address_id, customers(first_name, last_name), customer_addresses!delivery_address_id(line1), order_items(item_name_snapshot)")
    .eq("organization_id", ctx.organizationId)
    .eq("event_date", routeDate)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (!orders) return { eligible: [], blocked: [], totalForDate: 0 };

  const eligible: UnroutedOrder[] = [];
  const blocked: BlockedOrder[] = [];

  for (const o of orders) {
    if (onCurrentRoute.has(o.id)) continue; // already a stop on this route

    const customer = (o as Record<string, unknown>).customers as
      | { first_name?: string; last_name?: string }
      | null;
    const items = (o as Record<string, unknown>).order_items as
      | { item_name_snapshot?: string }[]
      | null;
    const customerName =
      [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
      "";
    const productName = items?.[0]?.item_name_snapshot ?? "";
    const status = (o.order_status as string) ?? "inquiry";

    // 1) Already on a different route for the same date.
    if (onOtherRoute.has(o.id)) {
      blocked.push({
        id: o.id,
        orderNumber: o.order_number ?? "",
        customerName,
        productName,
        reason: "on_other_route",
        currentStatus: status,
      });
      continue;
    }

    // 2) Status doesn't permit routing yet.  Terminal states (delivered,
    //    cancelled) get filtered out entirely — they're not actionable.
    if (!["confirmed", "scheduled"].includes(status)) {
      if (["delivered", "cancelled"].includes(status)) continue;
      blocked.push({
        id: o.id,
        orderNumber: o.order_number ?? "",
        customerName,
        productName,
        reason: "not_confirmed",
        currentStatus: status,
      });
      continue;
    }

    // 3) No delivery address — geocoding and routing both need a line1.
    const address = (o as Record<string, unknown>).customer_addresses as
      | { line1?: string | null }
      | null;
    const hasAddress = !!address?.line1?.trim();
    if (!hasAddress) {
      blocked.push({
        id: o.id,
        orderNumber: o.order_number ?? "",
        customerName,
        productName,
        reason: "no_address",
        currentStatus: status,
      });
      continue;
    }

    // 4) Everything checks out — show in the dropdown.
    eligible.push({
      id: o.id,
      orderNumber: o.order_number ?? "",
      customerName,
      eventDate: o.event_date ?? routeDate,
      status,
      productName,
    });
  }

  return {
    eligible,
    blocked,
    totalForDate: eligible.length + blocked.length + onCurrentRoute.size,
  };
}

export async function getTeamMembersForRoute(): Promise<{ id: string; name: string }[]> {
  if (!hasSupabaseEnv()) return [];

  const ctx = await getOrgContext();
  if (!ctx) return [];

  const supabase = await createSupabaseServerClient();
  const { data: members } = await supabase
    .from("organization_memberships")
    .select("profile_id, profiles(full_name)")
    .eq("organization_id", ctx.organizationId)
    .eq("status", "active");

  if (!members) return [];

  return members
    .map((m) => {
      const profile = (m as Record<string, unknown>).profiles as { full_name?: string } | null;
      return {
        id: m.profile_id,
        name: profile?.full_name ?? "Team member",
      };
    })
    .filter((m) => !!m.name);
}

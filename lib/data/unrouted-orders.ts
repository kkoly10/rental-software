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
    .eq("routes.organization_id", ctx.organizationId);

  const routedOrderIds = new Set((routedStops ?? []).map((s) => s.order_id));

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, order_status, event_date, customers(first_name, last_name), order_items(item_name_snapshot)")
    .eq("organization_id", ctx.organizationId)
    .eq("event_date", routeDate)
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
        customerName: [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer",
        eventDate: o.event_date ?? routeDate,
        status: o.order_status ?? "confirmed",
        productName: items?.[0]?.item_name_snapshot ?? "Rental",
      };
    });
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
    .eq("is_active", true);

  if (!members) return [];

  return members
    .map((m) => {
      const profile = (m as Record<string, unknown>).profiles as { full_name?: string } | null;
      return {
        id: m.profile_id,
        name: profile?.full_name ?? "Team member",
      };
    })
    .filter((m) => m.name !== "Team member" || true);
}

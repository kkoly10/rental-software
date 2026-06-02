"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { formatTimeInTimeZone } from "@/lib/datetime/event-time";
import { getOrgEventTimezone } from "@/lib/datetime/org-timezone";

export type PullSheetStop = {
  sequence: number;
  type: "delivery" | "pickup";
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  scheduledTime: string;
  items: { name: string; quantity: number }[];
  notes: string;
};

export type PullSheetAggregateItem = {
  name: string;
  totalQuantity: number;
  stopCount: number;
};

export type PullSheetData = {
  routeId: string;
  routeName: string;
  routeDate: string;
  driverName: string;
  vehicleName: string;
  organizationName: string;
  stops: PullSheetStop[];
  aggregated: PullSheetAggregateItem[];
};

const fallback: PullSheetData = {
  routeId: "route_1",
  routeName: "Crew A Morning Route",
  routeDate: "Mar 31, 2026",
  driverName: "Sample Driver",
  vehicleName: "Truck 1",
  organizationName: "Demo Rental Co.",
  stops: [
    {
      sequence: 1,
      type: "delivery",
      orderNumber: "ORD-1001",
      customerName: "Johnson Birthday",
      customerPhone: "(555) 123-4567",
      address: "123 Oak Lane, Stafford, VA",
      scheduledTime: "9:00 AM",
      items: [
        { name: "Bounce House — Large", quantity: 1 },
        { name: "Round Table — 60in", quantity: 4 },
        { name: "Folding Chair — White", quantity: 24 },
      ],
      notes: "",
    },
    {
      sequence: 2,
      type: "delivery",
      orderNumber: "ORD-1002",
      customerName: "Community Church Event",
      customerPhone: "(555) 987-6543",
      address: "456 Main St, Fredericksburg, VA",
      scheduledTime: "11:00 AM",
      items: [
        { name: "Round Table — 60in", quantity: 8 },
        { name: "Folding Chair — White", quantity: 64 },
      ],
      notes: "",
    },
  ],
  aggregated: [
    { name: "Bounce House — Large", totalQuantity: 1, stopCount: 1 },
    { name: "Round Table — 60in", totalQuantity: 12, stopCount: 2 },
    { name: "Folding Chair — White", totalQuantity: 88, stopCount: 2 },
  ],
};

export async function getPullSheetData(routeId: string): Promise<PullSheetData | null> {
  if (!hasSupabaseEnv()) {
    return { ...fallback, routeId };
  }

  const ctx = await getOrgContext();
  if (!ctx) return null;
  const tz = await getOrgEventTimezone(ctx.organizationId);

  const supabase = await createSupabaseServerClient();

  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select(
      "id, name, route_date, assigned_vehicle, profiles(full_name), organizations(name)"
    )
    .eq("id", routeId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (routeError || !route) return null;

  const { data: rawStops, error: stopsError } = await supabase
    .from("route_stops")
    .select(
      "id, stop_sequence, stop_type, scheduled_window_start, orders(order_number, customers(first_name, last_name, phone), customer_addresses!delivery_address_id(line1, city, state, postal_code), order_items(item_name_snapshot, quantity))"
    )
    .eq("route_id", routeId)
    .order("stop_sequence", { ascending: true })
    .limit(500);

  if (stopsError) return null;

  const driver = (route as Record<string, unknown>).profiles as {
    full_name: string;
  } | null;
  const org = (route as Record<string, unknown>).organizations as {
    name: string;
  } | null;

  const stops: PullSheetStop[] = (rawStops ?? [])
    .filter((stop) => (stop.stop_type ?? "delivery") === "delivery")
    .map((stop, index) => {
      const order = (stop as Record<string, unknown>).orders as {
        order_number?: string;
        customers?: {
          first_name?: string;
          last_name?: string;
          phone?: string;
        } | null;
        customer_addresses?: {
          line1?: string;
          city?: string;
          state?: string;
          postal_code?: string;
        } | null;
        order_items?: { item_name_snapshot?: string; quantity?: number }[] | null;
      } | null;

      const customer = order?.customers;
      const addr = order?.customer_addresses;
      const addressParts = [
        addr?.line1,
        addr?.city,
        addr?.state,
        addr?.postal_code,
      ].filter(Boolean);

      const items = (order?.order_items ?? [])
        .map((it) => ({
          name: it.item_name_snapshot ?? "Item",
          quantity: it.quantity ?? 1,
        }))
        .filter((it) => it.quantity > 0);

      return {
        sequence: stop.stop_sequence ?? index + 1,
        type: "delivery" as const,
        orderNumber: order?.order_number ?? "",
        customerName:
          customer
            ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
            : order?.order_number ?? "Stop",
        customerPhone: customer?.phone ?? "",
        address: addressParts.join(", "),
        scheduledTime: stop.scheduled_window_start
          ? formatTimeInTimeZone(stop.scheduled_window_start, tz)
          : "TBD",
        items,
        notes: "",
      };
    });

  // Aggregate by product name across all delivery stops, so the crew can
  // see at-a-glance: "load 12 tables, 88 chairs, 1 bounce house" instead of
  // walking each order line-by-line. Pickup stops aren't included since
  // they don't require pre-loading.
  const aggMap = new Map<string, { qty: number; stops: Set<number> }>();
  for (const stop of stops) {
    for (const item of stop.items) {
      const existing = aggMap.get(item.name);
      if (existing) {
        existing.qty += item.quantity;
        existing.stops.add(stop.sequence);
      } else {
        aggMap.set(item.name, {
          qty: item.quantity,
          stops: new Set([stop.sequence]),
        });
      }
    }
  }
  const aggregated: PullSheetAggregateItem[] = Array.from(aggMap.entries())
    .map(([name, v]) => ({
      name,
      totalQuantity: v.qty,
      stopCount: v.stops.size,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity);

  const formattedDate = route.route_date
    ? new Date(route.route_date + "T12:00:00Z").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "TBD";

  return {
    routeId: route.id,
    routeName: route.name ?? "Route",
    routeDate: formattedDate,
    driverName: driver?.full_name ?? "Unassigned",
    vehicleName: route.assigned_vehicle ?? "No vehicle assigned",
    organizationName: org?.name ?? "",
    stops,
    aggregated,
  };
}

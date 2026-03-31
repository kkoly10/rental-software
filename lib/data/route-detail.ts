import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import type { RouteDetail, RouteDetailEnhanced, RouteStopEnhanced } from "@/lib/types";

export type RouteStopData = {
  id: string;
  sequence: number;
  label: string;
  time: string;
  type: string;
  status: string;
};

const fallbackStops: RouteStopData[] = [
  { id: "stop_1", sequence: 1, label: "Johnson Birthday", time: "9:00 AM", type: "Delivery", status: "assigned" },
  { id: "stop_2", sequence: 2, label: "Church Event", time: "11:00 AM", type: "Delivery", status: "assigned" },
  { id: "stop_3", sequence: 3, label: "School Field Day", time: "4:00 PM", type: "Pickup", status: "assigned" },
];

const fallbackRouteDetail: RouteDetail = {
  id: "route_1",
  name: "Crew A Morning Route",
  crewLabel: "Driver + setup technician",
  vehicleLabel: "Truck 1 · Trailer attached",
  summaryLabel: "3 deliveries · 1 pickup later today",
  stops: [
    "1. Johnson Birthday · Stafford · 9:00 AM · Delivery",
    "2. Church Event · Fredericksburg · 11:00 AM · Delivery",
    "3. School Field Day · Pickup at 4:00 PM · Pickup",
  ],
};

export async function getRouteDetail(routeId: string): Promise<RouteDetail> {
  if (!hasSupabaseEnv()) {
    return { ...fallbackRouteDetail, id: routeId };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ...fallbackRouteDetail, id: routeId };
  }

  const supabase = await createSupabaseServerClient();
  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select("id, name, assigned_vehicle, route_status, profiles(full_name)")
    .eq("id", routeId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (routeError || !route) {
    return { ...fallbackRouteDetail, id: routeId };
  }

  const { data: stops } = await supabase
    .from("route_stops")
    .select(
      "id, stop_sequence, stop_type, scheduled_window_start, stop_status, orders(order_number, customers(first_name, last_name))"
    )
    .eq("route_id", routeId)
    .order("stop_sequence", { ascending: true });

  const driver = (route as Record<string, unknown>).profiles as {
    full_name: string;
  } | null;

  return {
    id: route.id,
    name: route.name ?? "Route",
    crewLabel: driver?.full_name ?? "Unassigned crew",
    vehicleLabel: route.assigned_vehicle ?? "No vehicle assigned",
    summaryLabel: `${stops?.length ?? 0} stops · ${(route.route_status ?? "planned").replace(/_/g, " ")}`,
    stops:
      stops && stops.length > 0
        ? stops.map((stop, index) => {
            const seq = stop.stop_sequence ?? index + 1;
            const order = (stop as Record<string, unknown>).orders as {
              order_number: string;
              customers: { first_name: string; last_name: string } | null;
            } | null;
            const customer = order?.customers;
            const label = customer
              ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
              : order?.order_number ?? "Stop";
            const time = stop.scheduled_window_start
              ? new Date(stop.scheduled_window_start).toLocaleTimeString(
                  "en-US",
                  { hour: "numeric", minute: "2-digit" }
                )
              : "TBD";
            const type = (stop.stop_type ?? "delivery").replace(
              /\b\w/g,
              (c: string) => c.toUpperCase()
            );
            const status = (stop.stop_status ?? "assigned")
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c: string) => c.toUpperCase());
            return `${seq}. ${label} · ${time} · ${type} · ${status}`;
          })
        : ["No stops assigned yet"],
  };
}

export async function getRouteStops(routeId: string): Promise<RouteStopData[]> {
  if (!hasSupabaseEnv()) {
    return fallbackStops;
  }

  const supabase = await createSupabaseServerClient();
  const { data: stops, error } = await supabase
    .from("route_stops")
    .select("id, stop_sequence, stop_type, scheduled_window_start, stop_status, orders(order_number, customers(first_name, last_name))")
    .eq("route_id", routeId)
    .order("stop_sequence", { ascending: true });

  if (error || !stops || stops.length === 0) {
    return fallbackStops;
  }

  return stops.map((stop, index) => {
    const order = (stop as Record<string, unknown>).orders as { order_number: string; customers: { first_name: string; last_name: string } | null } | null;
    const customer = order?.customers;
    return {
      id: stop.id,
      sequence: stop.stop_sequence ?? index + 1,
      label: customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : order?.order_number ?? "Stop",
      time: stop.scheduled_window_start
        ? new Date(stop.scheduled_window_start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : "TBD",
      type: (stop.stop_type ?? "delivery").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      status: stop.stop_status ?? "assigned",
    };
  });
}

/* ── Enhanced route detail with lat/lng and address data ── */

const fallbackEnhancedStops: RouteStopEnhanced[] = [
  {
    id: "stop_1",
    sequence: 1,
    type: "delivery",
    status: "completed",
    address: "123 Oak Lane, Stafford, VA 22554",
    customerName: "Johnson Birthday Party",
    scheduledTime: "9:00 AM",
    lat: 38.4220,
    lng: -77.4083,
  },
  {
    id: "stop_2",
    sequence: 2,
    type: "delivery",
    status: "in_progress",
    address: "456 Main St, Fredericksburg, VA 22401",
    customerName: "Community Church Event",
    scheduledTime: "11:00 AM",
    lat: 38.3032,
    lng: -77.4605,
  },
  {
    id: "stop_3",
    sequence: 3,
    type: "delivery",
    status: "assigned",
    address: "789 School Rd, Spotsylvania, VA 22553",
    customerName: "Riverview Elementary Field Day",
    scheduledTime: "1:30 PM",
    lat: 38.1996,
    lng: -77.5892,
  },
  {
    id: "stop_4",
    sequence: 4,
    type: "pickup",
    status: "assigned",
    address: "321 Park Ave, Stafford, VA 22554",
    customerName: "Martinez Wedding (pickup)",
    scheduledTime: "4:00 PM",
    lat: 38.4301,
    lng: -77.3672,
  },
];

const fallbackEnhancedDetail: RouteDetailEnhanced = {
  id: "route_1",
  name: "Crew A Morning Route",
  routeDate: "Mar 31, 2026",
  routeStatus: "in_progress",
  crewLabel: "Driver + setup technician",
  vehicleLabel: "Truck 1 · Trailer attached",
  totalStops: 4,
  completedStops: 1,
  inProgressStops: 1,
  nextDeliveryTime: "1:30 PM",
  stops: fallbackEnhancedStops,
};

export async function getRouteDetailEnhanced(
  routeId: string
): Promise<RouteDetailEnhanced> {
  if (!hasSupabaseEnv()) {
    return { ...fallbackEnhancedDetail, id: routeId };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ...fallbackEnhancedDetail, id: routeId };
  }

  const supabase = await createSupabaseServerClient();
  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select("id, name, route_date, assigned_vehicle, route_status, profiles(full_name)")
    .eq("id", routeId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (routeError || !route) {
    return { ...fallbackEnhancedDetail, id: routeId };
  }

  const { data: stops } = await supabase
    .from("route_stops")
    .select(
      "id, stop_sequence, stop_type, scheduled_window_start, scheduled_window_end, stop_status, orders(order_number, customers(first_name, last_name, address_line1, address_city, address_state, address_postal_code, latitude, longitude))"
    )
    .eq("route_id", routeId)
    .order("stop_sequence", { ascending: true });

  const driver = (route as Record<string, unknown>).profiles as {
    full_name: string;
  } | null;

  const enhancedStops: RouteStopEnhanced[] = (stops ?? []).map((stop, index) => {
    const order = (stop as Record<string, unknown>).orders as {
      order_number: string;
      customers: {
        first_name: string;
        last_name: string;
        address_line1?: string;
        address_city?: string;
        address_state?: string;
        address_postal_code?: string;
        latitude?: number;
        longitude?: number;
      } | null;
    } | null;
    const customer = order?.customers;
    const name = customer
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : order?.order_number ?? "Stop";

    const addressParts = [
      customer?.address_line1,
      customer?.address_city,
      customer?.address_state,
      customer?.address_postal_code,
    ].filter(Boolean);

    const time = stop.scheduled_window_start
      ? new Date(stop.scheduled_window_start).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : undefined;

    return {
      id: stop.id,
      sequence: stop.stop_sequence ?? index + 1,
      type: (stop.stop_type ?? "delivery") as "delivery" | "pickup",
      status: (stop.stop_status ?? "assigned") as RouteStopEnhanced["status"],
      address: addressParts.length > 0 ? addressParts.join(", ") : undefined,
      customerName: name,
      scheduledTime: time,
      lat: customer?.latitude ?? undefined,
      lng: customer?.longitude ?? undefined,
    };
  });

  const completedStops = enhancedStops.filter((s) => s.status === "completed").length;
  const inProgressStops = enhancedStops.filter((s) => s.status === "in_progress").length;
  const nextStop = enhancedStops.find(
    (s) => s.status === "assigned" || s.status === "en_route"
  );

  return {
    id: route.id,
    name: route.name ?? "Route",
    routeDate: route.route_date
      ? new Date(route.route_date + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "TBD",
    routeStatus: route.route_status ?? "planned",
    crewLabel: driver?.full_name ?? "Unassigned crew",
    vehicleLabel: route.assigned_vehicle ?? "No vehicle assigned",
    totalStops: enhancedStops.length,
    completedStops,
    inProgressStops,
    nextDeliveryTime: nextStop?.scheduledTime,
    stops: enhancedStops,
  };
}
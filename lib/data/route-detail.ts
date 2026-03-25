import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RouteDetail } from "@/lib/types";

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

  const supabase = await createSupabaseServerClient();
  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select("id, name, assigned_vehicle, route_status, profiles(full_name)")
    .eq("id", routeId)
    .maybeSingle();

  if (routeError || !route) {
    return { ...fallbackRouteDetail, id: routeId };
  }

  const { data: stops } = await supabase
    .from("route_stops")
    .select("id, stop_sequence, stop_type, scheduled_window_start, stop_status, orders(order_number, customers(first_name, last_name))")
    .eq("route_id", routeId)
    .order("stop_sequence", { ascending: true });

  const driver = (route as Record<string, unknown>).profiles as { full_name: string } | null;

  return {
    id: route.id,
    name: route.name ?? "Route",
    crewLabel: driver?.full_name ?? "Unassigned crew",
    vehicleLabel: route.assigned_vehicle ?? "No vehicle assigned",
    summaryLabel: `${stops?.length ?? 0} stops · ${(route.route_status ?? "planned").replace(/_/g, " ")}`,
    stops: stops && stops.length > 0
      ? stops.map((stop, index) => {
          const seq = stop.stop_sequence ?? index + 1;
          const order = (stop as Record<string, unknown>).orders as { order_number: string; customers: { first_name: string; last_name: string } | null } | null;
          const customer = order?.customers;
          const label = customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : order?.order_number ?? "Stop";
          const time = stop.scheduled_window_start
            ? new Date(stop.scheduled_window_start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            : "TBD";
          const type = (stop.stop_type ?? "delivery").replace(/\b\w/g, (c: string) => c.toUpperCase());
          const status = (stop.stop_status ?? "assigned").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
          return `${seq}. ${label} · ${time} · ${type} · ${status}`;
        })
      : ["No stops assigned yet"],
  };
}

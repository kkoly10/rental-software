import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const fallbackRouteDetail = {
  id: "route_1",
  name: "Crew A Morning Route",
  crewLabel: "Driver + setup technician",
  vehicleLabel: "Truck 1 · Trailer attached",
  summaryLabel: "3 deliveries · 1 pickup later today",
  stops: [
    "1. Johnson Birthday · Stafford · 9:00 AM",
    "2. Church Event · Fredericksburg · 11:00 AM",
    "3. School Field Day · Pickup at 4:00 PM",
  ],
};

export async function getRouteDetail(routeId: string) {
  if (!hasSupabaseEnv()) {
    return {
      ...fallbackRouteDetail,
      id: routeId,
    };
  }

  const supabase = createSupabaseServerClient();
  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select("id, name, assigned_vehicle, route_status")
    .eq("id", routeId)
    .maybeSingle();

  const { data: stops, error: stopsError } = await supabase
    .from("route_stops")
    .select("id, stop_sequence, stop_type, scheduled_window_start, stop_status")
    .eq("route_id", routeId)
    .order("stop_sequence", { ascending: true });

  if (routeError || !route || stopsError) {
    return {
      ...fallbackRouteDetail,
      id: routeId,
    };
  }

  return {
    id: route.id,
    name: route.name ?? "Route",
    crewLabel: "Crew assignment from live route data next",
    vehicleLabel: route.assigned_vehicle ?? "Unassigned vehicle",
    summaryLabel: `${stops?.length ?? 0} stops · ${route.route_status ?? "planned"}`,
    stops:
      stops?.map((stop, index) => {
        const sequence = stop.stop_sequence ?? index + 1;
        const time = stop.scheduled_window_start ?? "TBD";
        return `${sequence}. ${stop.stop_type ?? "stop"} · ${time} · ${stop.stop_status ?? "assigned"}`;
      }) ?? ["No stops yet"],
  };
}

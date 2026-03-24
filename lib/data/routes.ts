import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const fallbackRoutes = [
  {
    id: "route_1",
    name: "Crew A Morning Route",
    date: "May 24, 2026",
    status: "planned",
    stops: 3,
  },
  {
    id: "route_2",
    name: "Crew B Afternoon Route",
    date: "May 24, 2026",
    status: "in_progress",
    stops: 2,
  },
];

export async function getRoutes() {
  if (!hasSupabaseEnv()) {
    return fallbackRoutes;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("routes")
    .select("id, name, route_date, route_status")
    .order("route_date", { ascending: false });

  if (error || !data) {
    return fallbackRoutes;
  }

  return data.map((route) => ({
    id: route.id,
    name: route.name ?? "Route",
    date: route.route_date ?? "TBD",
    status: route.route_status ?? "planned",
    stops: 0,
  }));
}

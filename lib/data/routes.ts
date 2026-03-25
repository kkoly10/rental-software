import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import type { RouteSummary } from "@/lib/types";

const fallbackRoutes: RouteSummary[] = [
  { id: "route_1", name: "Crew A Morning Route", date: "May 24, 2026", status: "planned", stops: 3 },
  { id: "route_2", name: "Crew B Afternoon Route", date: "May 24, 2026", status: "in_progress", stops: 2 },
];

export async function getRoutes(): Promise<RouteSummary[]> {
  if (!hasSupabaseEnv()) {
    return fallbackRoutes;
  }

  const ctx = await getOrgContext();
  if (!ctx) return fallbackRoutes;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("routes")
    .select("id, name, route_date, route_status, route_stops(id)")
    .eq("organization_id", ctx.organizationId)
    .order("route_date", { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    return fallbackRoutes;
  }

  return data.map((route) => {
    const stops = ((route as Record<string, unknown>).route_stops as { id: string }[] | null) ?? [];
    return {
      id: route.id,
      name: route.name ?? "Route",
      date: route.route_date
        ? new Date(route.route_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "TBD",
      status: route.route_status ?? "planned",
      stops: stops.length,
    };
  });
}

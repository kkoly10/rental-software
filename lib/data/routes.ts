import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import type { RouteSummary } from "@/lib/types";

const fallbackRoutes: RouteSummary[] = [
  { id: "route_1", name: "Crew A Morning Route", date: "May 24, 2026", status: "planned", stops: 3 },
  { id: "route_2", name: "Crew B Afternoon Route", date: "May 24, 2026", status: "in_progress", stops: 2 },
];

export async function getRoutes(date?: string): Promise<RouteSummary[]> {
  if (!hasSupabaseEnv()) {
    return fallbackRoutes;
  }

  const ctx = await getOrgContext();
  if (!ctx) return [];

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("routes")
    .select("id, name, route_date, route_status, route_stops(id)")
    .eq("organization_id", ctx.organizationId)
    .order("route_date", { ascending: false })
    .limit(50);

  if (date) {
    // Include yesterday (UTC) as lower bound to cover US timezones where local date
    // may lag UTC by up to ~12 hours (e.g. at 8 PM Eastern, UTC is already tomorrow).
    const dateObj = new Date(date + "T00:00:00Z");
    const yesterday = new Date(dateObj);
    yesterday.setUTCDate(dateObj.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    query = query.gte("route_date", yesterdayStr).lte("route_date", date);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[routes] Query failed:", error.message);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
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

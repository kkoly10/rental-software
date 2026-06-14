import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getLocale } from "@/lib/i18n/server";
import { formatTimeInTimeZone } from "@/lib/datetime/event-time";
import { getOrgEventTimezone } from "@/lib/datetime/org-timezone";
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

  // Crew members see only routes they are assigned to drive
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();

  let query = supabase
    .from("routes")
    .select(
      // Pull scheduled_window_start on each stop so the board can render an
      // earliest/latest time range without an extra round-trip (decision 4.3).
      "id, name, route_date, route_status, route_stops(id, scheduled_window_start), profiles(full_name)"
    )
    .eq("organization_id", ctx.organizationId)
    .order("route_date", { ascending: false })
    .limit(50);

  if (membership?.role === "crew") {
    query = query.eq("assigned_driver_profile_id", ctx.userId);
  }

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

  const tz = await getOrgEventTimezone(ctx.organizationId);
  const locale = await getLocale();

  return data.map((route) => {
    const stops = ((route as Record<string, unknown>).route_stops as
      | { id: string; scheduled_window_start?: string | null }[]
      | null) ?? [];
    const driver = (route as Record<string, unknown>).profiles as { full_name?: string } | null;

    // Earliest / latest scheduled time across the route. Filters out null
    // and non-finite values so an unscheduled stop doesn't pull the range
    // to "12:00 AM". Display-ready strings live on RouteSummary so the
    // kanban card can render them without recomputing per render.
    const scheduledTimestamps = stops
      .map((s) => s.scheduled_window_start)
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map((v) => ({ raw: v, ms: new Date(v).getTime() }))
      .filter((v) => Number.isFinite(v.ms));
    let earliestStopTime: string | undefined;
    let latestStopTime: string | undefined;
    if (scheduledTimestamps.length > 0) {
      const sorted = [...scheduledTimestamps].sort((a, b) => a.ms - b.ms);
      earliestStopTime = formatTimeInTimeZone(sorted[0].raw, tz);
      const last = sorted[sorted.length - 1];
      // Only render `latestStopTime` separately when it's distinct from the
      // earliest — a single scheduled stop should show one time, not a range.
      if (sorted.length > 1 && last.ms !== sorted[0].ms) {
        latestStopTime = formatTimeInTimeZone(last.raw, tz);
      }
    }

    return {
      id: route.id,
      name: route.name ?? "Route",
      date: route.route_date
        ? new Date(route.route_date + "T12:00:00Z").toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
        : "TBD",
      status: route.route_status ?? "planned",
      stops: stops.length,
      driverName: driver?.full_name ?? undefined,
      earliestStopTime,
      latestStopTime,
    };
  });
}

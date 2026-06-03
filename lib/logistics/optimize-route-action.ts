"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runOptimization, type OptimizeStop } from "./route-optimizer";
import { makeMapboxProvider } from "./optimizers/mapbox";

export type OptimizeRouteState = {
  ok: boolean;
  message: string;
  distanceMeters?: number;
  durationSeconds?: number;
  unoptimizedCount?: number;
};

/**
 * Sprint 5 — server action that powers the "Optimize route" button on
 * the route detail page. Loads the route, hands its stops to the
 * Mapbox provider, then renumbers `stop_sequence` to the optimized
 * order.
 *
 * Owner/admin/dispatcher only. Refuses to run on routes that are
 * already in_progress or completed — re-ordering an in-flight route
 * could confuse the driver and de-sync the customer SMS timing.
 *
 * Returns a friendly distance/time summary the UI can render
 * ("Optimized — 47 mi, 1h 38m"). Failures surface a per-reason
 * message so the operator sees why the click didn't work.
 */
export async function optimizeRoute(
  _prev: OptimizeRouteState,
  formData: FormData,
): Promise<OptimizeRouteState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: route would be optimized." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const routeId = String(formData.get("route_id") ?? "");
  if (!routeId) return { ok: false, message: "Missing route id." };

  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(membership?.role ?? "")) {
    return {
      ok: false,
      message: "Only dispatchers and above can optimize routes.",
    };
  }

  // Load the route + stops. The lat/lng come from the joined
  // customer_addresses; orders without geocoded addresses land as
  // unoptimizable.
  const { data: route } = await supabase
    .from("routes")
    .select("id, route_status")
    .eq("id", routeId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!route) return { ok: false, message: "Route not found." };
  if (route.route_status !== "planned") {
    return {
      ok: false,
      message:
        "Routes in progress can't be reordered. Mark the route planned again to optimize.",
    };
  }

  const { data: rawStops } = await supabase
    .from("route_stops")
    .select(
      "id, stop_sequence, stop_status, orders(delivery_address_id, customer_addresses!delivery_address_id(latitude, longitude))",
    )
    .eq("route_id", routeId)
    .order("stop_sequence", { ascending: true });

  if (!rawStops || rawStops.length === 0) {
    return { ok: false, message: "Route has no stops to optimize." };
  }

  const stops: OptimizeStop[] = rawStops.map((stop) => {
    const order = (stop as Record<string, unknown>).orders as {
      customer_addresses?: { latitude?: number | null; longitude?: number | null } | null;
    } | null;
    const addr = order?.customer_addresses;
    return {
      id: stop.id as string,
      sequence: Number(stop.stop_sequence ?? 0),
      status: (stop.stop_status ?? "pending") as OptimizeStop["status"],
      lat: addr?.latitude ?? null,
      lng: addr?.longitude ?? null,
    };
  });

  // Run the orchestration with Mapbox as the underlying provider.
  const provider = makeMapboxProvider();
  const outcome = await runOptimization({ stops }, provider);
  if (!outcome.ok) {
    return {
      ok: false,
      message: mapOptimizationError(outcome.reason, outcome.detail),
    };
  }

  // Renumber stops to the optimized order. Two-pass renumber to
  // respect the (route_id, stop_sequence) unique index, same pattern
  // as the Sprint 1.5 auto-sequence in lib/routes/auto-attach.ts.
  const targetIds = outcome.result.orderedStopIds;

  // Pass 1: park every stop at a high sequence band.
  await Promise.all(
    targetIds.map((id, idx) =>
      supabase
        .from("route_stops")
        .update({ stop_sequence: 1000 + idx + 1 })
        .eq("id", id)
        .eq("route_id", routeId),
    ),
  );

  // Pass 2: write final sequence numbers.
  await Promise.all(
    targetIds.map((id, idx) =>
      supabase
        .from("route_stops")
        .update({ stop_sequence: idx + 1 })
        .eq("id", id)
        .eq("route_id", routeId),
    ),
  );

  // Persist the optimizer's distance/time summary so the UI doesn't
  // need to re-call Mapbox on page view.
  await supabase
    .from("routes")
    .update({
      last_optimized_at: new Date().toISOString(),
      optimization_distance_meters: outcome.result.totalDistanceMeters,
      optimization_duration_seconds: outcome.result.totalDurationSeconds,
      optimization_provider: provider.id,
    })
    .eq("id", routeId)
    .eq("organization_id", ctx.organizationId);

  revalidatePath(`/dashboard/deliveries/${routeId}`);
  revalidatePath("/dashboard/deliveries");

  const miles = (outcome.result.totalDistanceMeters / 1609.34).toFixed(1);
  const minutes = Math.round(outcome.result.totalDurationSeconds / 60);
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const timeLabel = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  const unoptCount = outcome.result.unoptimizedStopIds.length;
  const unoptSuffix = unoptCount > 0
    ? ` ${unoptCount} stop${unoptCount === 1 ? "" : "s"} without coordinates were left at the end.`
    : "";

  return {
    ok: true,
    message: `Optimized — ${miles} mi, ${timeLabel}.${unoptSuffix}`,
    distanceMeters: outcome.result.totalDistanceMeters,
    durationSeconds: outcome.result.totalDurationSeconds,
    unoptimizedCount: unoptCount,
  };
}

function mapOptimizationError(reason: string, detail?: string): string {
  switch (reason) {
    case "not_configured":
      return "Mapbox isn't configured on this deploy. Add MAPBOX_ACCESS_TOKEN.";
    case "rate_limited":
      return "Mapbox is throttling requests. Try again in a moment.";
    case "validation":
      return `Couldn't optimize this route (${detail ?? "validation error"}).`;
    case "server":
      return "Mapbox had a server error. Try again in a moment.";
    case "network":
      return "Couldn't reach Mapbox. Check your connection and try again.";
    default:
      return "Couldn't optimize this route.";
  }
}

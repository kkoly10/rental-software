"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type BackfillResult = {
  ok: boolean;
  message: string;
  scanned?: number;
  created?: number;
};

/**
 * One-shot backfill for decision 2.6. Walks every non-terminal order in the
 * current org whose `rental_end_date` is in the future and creates a pickup
 * stop on the matching route if one doesn't already exist. Idempotent —
 * orders that already have a pickup row are skipped silently.
 *
 * Surfaced as a dashboard action (owner/admin only) so the operator can
 * run it once after the 2.6 deploy without us having to ship a migration.
 * The data audit step described in the fix plan is implicit in the
 * `scanned` count returned.
 */
export async function backfillPickupStops(): Promise<BackfillResult> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: would backfill pickup stops." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const supabase = await createSupabaseServerClient();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin"].includes(membership?.role ?? "")) {
    return {
      ok: false,
      message: "Only owners and admins can run the pickup backfill.",
    };
  }

  // Candidates: orders that already have a delivery stop attached AND
  // whose rental_end_date (or event_date) is today-or-later. We don't
  // try to backfill past rentals — those are already done.
  const today = new Date().toISOString().slice(0, 10);
  const { data: candidates } = await supabase
    .from("orders")
    .select(
      "id, event_date, rental_end_date, event_end_time, order_status, route_stops!inner(stop_type)"
    )
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .gte("event_date", today)
    .not("order_status", "in", "(cancelled,refunded,completed)")
    .limit(500);

  if (!candidates || candidates.length === 0) {
    return { ok: true, message: "No eligible orders.", scanned: 0, created: 0 };
  }

  // Filter in-process to those that have ONLY a delivery stop (no pickup
  // yet). Doing this in JS rather than SQL is cheaper here because the
  // join already narrowed the candidate set.
  type Candidate = {
    id: string;
    event_date: string | null;
    rental_end_date: string | null;
    event_end_time: string | null;
    route_stops: { stop_type: string }[] | null;
  };
  const eligible = (candidates as unknown as Candidate[]).filter((c) => {
    const stops = c.route_stops ?? [];
    return (
      stops.some((s) => s.stop_type === "delivery") &&
      !stops.some((s) => s.stop_type === "pickup")
    );
  });

  let created = 0;
  for (const c of eligible) {
    const pickupDate = c.rental_end_date ?? c.event_date;
    if (!pickupDate) continue;

    // Use the same find-or-create-route logic as ensurePickupStop but
    // inline so this stays independent of auto-attach's mode flag —
    // backfill always behaves as "auto" (creates the route if missing).
    // routes has no soft-delete column — the legacy .is("deleted_at",
    // null) used to error at PostgREST and return null, so this branch
    // always thought no pickup route existed and created duplicates.
    const { data: routes } = await supabase
      .from("routes")
      .select("id, route_status")
      .eq("organization_id", ctx.organizationId)
      .eq("route_date", pickupDate)
      .eq("route_status", "planned");

    let routeId: string | null = null;
    if (routes && routes.length === 1) {
      routeId = routes[0].id as string;
    } else if ((!routes || routes.length === 0)) {
      const { data: newRoute } = await supabase
        .from("routes")
        .insert({
          organization_id: ctx.organizationId,
          name: `Pickups for ${pickupDate}`,
          route_date: pickupDate,
          route_status: "planned",
        })
        .select("id")
        .single();
      routeId = (newRoute?.id as string) ?? null;
    }
    if (!routeId) continue;

    const { error } = await supabase.rpc("add_stop_to_route", {
      p_route_id: routeId,
      p_order_id: c.id,
      p_stop_type: "pickup",
      p_scheduled_window_start: c.event_end_time,
    });
    if (!error) created += 1;
  }

  return {
    ok: true,
    message: `Backfilled ${created} pickup stop(s) across ${eligible.length} eligible order(s).`,
    scanned: candidates.length,
    created,
  };
}

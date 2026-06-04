"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type RouteActionState = { ok: boolean; message: string; routeId?: string };

export async function createRoute(
  _prev: RouteActionState,
  formData: FormData
): Promise<RouteActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Route would be created." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const supabase = await createSupabaseServerClient();
  const { data: rm } = await supabase.from("organization_memberships").select("role")
    .eq("organization_id", ctx.organizationId).eq("profile_id", ctx.userId).eq("status", "active").maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(rm?.role ?? "")) {
    return { ok: false, message: "Only dispatchers and above can manage routes." };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, 255);
  const routeDate = String(formData.get("route_date") ?? "").trim();
  const driverProfileId = String(formData.get("driver_profile_id") ?? "").trim() || null;
  const assignedVehicle = String(formData.get("assigned_vehicle") ?? "").trim().slice(0, 255) || null;

  if (!routeDate) return { ok: false, message: "Route date is required." };

  // Don't let an arbitrary/foreign profile id be assigned as the driver.
  if (driverProfileId) {
    const { data: driver } = await supabase.from("organization_memberships").select("profile_id")
      .eq("organization_id", ctx.organizationId).eq("profile_id", driverProfileId).eq("status", "active").maybeSingle();
    if (!driver) {
      return { ok: false, message: "Selected driver is not a member of this organization." };
    }
  }

  const { data, error } = await supabase
    .from("routes")
    .insert({
      organization_id: ctx.organizationId,
      name: name || `Route ${routeDate}`,
      route_date: routeDate,
      assigned_driver_profile_id: driverProfileId,
      assigned_vehicle: assignedVehicle,
      route_status: "planned",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Failed to create route." };
  }

  revalidatePath("/dashboard/deliveries");
  return { ok: true, message: "Route created.", routeId: data.id };
}

export async function addOrderToRoute(
  _prev: RouteActionState,
  formData: FormData
): Promise<RouteActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Stop would be added." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const supabase = await createSupabaseServerClient();
  const { data: arm } = await supabase.from("organization_memberships").select("role")
    .eq("organization_id", ctx.organizationId).eq("profile_id", ctx.userId).eq("status", "active").maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(arm?.role ?? "")) {
    return { ok: false, message: "Only dispatchers and above can manage routes." };
  }

  const routeId = String(formData.get("route_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "");
  const rawStopType = String(formData.get("stop_type") ?? "delivery");
  const VALID_STOP_TYPES = ["delivery", "pickup"];
  const stopType = VALID_STOP_TYPES.includes(rawStopType) ? rawStopType : "delivery";
  const scheduledTime = String(formData.get("scheduled_time") ?? "").trim() || null;
  const routeDate = String(formData.get("route_date") ?? "").trim();

  if (!routeId || !orderId) {
    return { ok: false, message: "Route and order are required." };
  }

  // Verify the route belongs to this org
  const { data: route } = await supabase
    .from("routes")
    .select("id")
    .eq("id", routeId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!route) return { ok: false, message: "Route not found." };

  // Verify the order belongs to this organization before assigning it to any route
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) return { ok: false, message: "Order not found." };

  // Guard: prevent adding the same order to multiple routes
  const { data: existingStop } = await supabase
    .from("route_stops")
    .select("id, route_id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existingStop) {
    if (existingStop.route_id === routeId) {
      return { ok: false, message: "This order is already on this route." };
    }
    return { ok: false, message: "This order is already assigned to another route." };
  }

  let scheduledWindowStart: string | null = null;
  if (scheduledTime && routeDate) {
    // Compose `${routeDate}T${scheduledTime}:00Z` (with the Z suffix).
    // Without the Z the JS Date parses in the server's local TZ — on a
    // Vercel UTC machine that happens to round-trip, but a server in
    // any other zone would shift the stored timestamp. Anchoring to
    // UTC matches the rest of the route/stop time storage and is
    // unambiguous regardless of server locale. The org's
    // event_timezone (PR 8) determines how this is rendered.
    const parsed = new Date(`${routeDate}T${scheduledTime}:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, message: "Invalid scheduled time for the route date." };
    }
    scheduledWindowStart = parsed.toISOString();
  }

  // Atomic insert via the add_stop_to_route RPC — locks the parent
  // route row so concurrent attaches serialise.  See
  // supabase/migrations/20260531_010000_add_stop_to_route_function.sql
  const { error } = await supabase.rpc("add_stop_to_route", {
    p_route_id: routeId,
    p_order_id: orderId,
    p_stop_type: stopType,
    p_scheduled_window_start: scheduledWindowStart,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/deliveries/${routeId}`);
  revalidatePath("/dashboard/deliveries");
  return { ok: true, message: "Stop added to route." };
}

export async function removeStopFromRoute(
  _prev: RouteActionState,
  formData: FormData
): Promise<RouteActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Stop would be removed." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const supabase = await createSupabaseServerClient();
  const { data: rrm } = await supabase.from("organization_memberships").select("role")
    .eq("organization_id", ctx.organizationId).eq("profile_id", ctx.userId).eq("status", "active").maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(rrm?.role ?? "")) {
    return { ok: false, message: "Only dispatchers and above can manage routes." };
  }

  const stopId = String(formData.get("stop_id") ?? "");
  const routeId = String(formData.get("route_id") ?? "");

  // Verify the stop belongs to a route owned by this org before deleting
  const { data: stop } = await supabase
    .from("route_stops")
    .select("id, routes!inner(organization_id)")
    .eq("id", stopId)
    .eq("routes.organization_id", ctx.organizationId)
    .maybeSingle();

  if (!stop) return { ok: false, message: "Stop not found." };

  const { error: deleteError } = await supabase.from("route_stops").delete().eq("id", stopId).eq("route_id", routeId);

  if (deleteError) return { ok: false, message: deleteError.message };

  // Resequence remaining stops to close the gap left by the deleted stop
  const { data: remaining } = await supabase
    .from("route_stops")
    .select("id, stop_sequence")
    .eq("route_id", routeId)
    .order("stop_sequence", { ascending: true });

  if (remaining && remaining.length > 0) {
    await Promise.all(
      remaining.map((s, idx) =>
        supabase
          .from("route_stops")
          .update({ stop_sequence: idx + 1 })
          .eq("id", s.id)
      )
    );
  } else {
    // Last stop removed. Auto-delete the zombie row when the route is
    // still `planned` — touching an in_progress / completed route
    // would lose audit history that ops might want to investigate, so
    // those stay. The route_status check below also covers manual
    // mode: even there, a planned-status route with zero stops is
    // unambiguous garbage (an operator who wanted to keep it would
    // have added back another stop already). Smart Delivery Mode
    // (Sprint 1.5) doesn't need a routing_mode branch here because
    // the rule is the same in both modes.
    await supabase
      .from("routes")
      .delete()
      .eq("id", routeId)
      .eq("organization_id", ctx.organizationId)
      .eq("route_status", "planned");
  }

  revalidatePath(`/dashboard/deliveries/${routeId}`);
  return { ok: true, message: "Stop removed." };
}

export async function updateRouteStatus(
  _prev: RouteActionState,
  formData: FormData
): Promise<RouteActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Status would be updated." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const routeId = String(formData.get("route_id") ?? "");
  const status = String(formData.get("status") ?? "");

  // #341 Drop "cancelled" — the rest of the codebase (analytics, delivery
  // board, crew auto-complete) treats only planned/in_progress/completed,
  // so accepting cancelled here just creates zombie rows. Operators who
  // actually need to abandon a route can delete it instead.
  const VALID_ROUTE_STATUSES = ["planned", "in_progress", "completed"];
  if (!VALID_ROUTE_STATUSES.includes(status)) {
    return { ok: false, message: "Invalid route status." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: rsm } = await supabase.from("organization_memberships").select("role")
    .eq("organization_id", ctx.organizationId).eq("profile_id", ctx.userId).eq("status", "active").maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(rsm?.role ?? "")) {
    return { ok: false, message: "Only dispatchers and above can manage routes." };
  }

  // #349 Don't allow terminal → non-terminal transitions; without this guard
  // an operator could flip a completed route back to planned and wipe out
  // historical state implicitly.

  // Manual route-completion guard: refuse if any stops are still
  // pending or en_route. Without this, a dispatcher can mark a route
  // "completed" mid-day, which immediately suppresses it from the
  // delivery board and the crew can no longer interact with their
  // remaining stops. Skipped stops are fine; they're terminal.
  if (status === "completed") {
    const { count: unfinishedCount } = await supabase
      .from("route_stops")
      .select("id", { count: "exact", head: true })
      .eq("route_id", routeId)
      .in("stop_status", ["pending", "en_route"]);
    if ((unfinishedCount ?? 0) > 0) {
      return {
        ok: false,
        message: "Some stops are still pending or in progress. Mark them completed or skipped first.",
      };
    }
  }

  const { error } = await supabase
    .from("routes")
    .update({ route_status: status })
    .eq("id", routeId)
    .eq("organization_id", ctx.organizationId)
    .not("route_status", "in", "(completed)");

  if (error) {
    console.error("[routes] updateRouteStatus failed:", error.message);
    return { ok: false, message: "Couldn't update the route status." };
  }

  revalidatePath("/dashboard/deliveries");
  revalidatePath(`/dashboard/deliveries/${routeId}`);
  return { ok: true, message: `Route marked ${status}.` };
}

export async function updateStopStatus(
  _prev: RouteActionState,
  formData: FormData
): Promise<RouteActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Stop status would be updated." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const stopId = String(formData.get("stop_id") ?? "");
  const routeId = String(formData.get("route_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const orderId = String(formData.get("order_id") ?? "") || null;

  const VALID_STOP_STATUSES = ["pending", "en_route", "completed", "skipped"];
  if (!VALID_STOP_STATUSES.includes(status)) {
    return { ok: false, message: "Invalid stop status." };
  }

  const supabase = await createSupabaseServerClient();

  // Dispatcher+ only (matches every other route-management action); crew use
  // the separate crew action which enforces route assignment.
  const { data: ssrm } = await supabase.from("organization_memberships").select("role")
    .eq("organization_id", ctx.organizationId).eq("profile_id", ctx.userId).eq("status", "active").maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(ssrm?.role ?? "")) {
    return { ok: false, message: "Only dispatchers and above can manage routes." };
  }

  // Verify the stop belongs to a route owned by this org before updating
  const { data: stop } = await supabase
    .from("route_stops")
    .select("id, stop_type, order_id, stop_status, routes!inner(organization_id)")
    .eq("id", stopId)
    .maybeSingle();

  if (!stop || (stop.routes as unknown as { organization_id: string }).organization_id !== ctx.organizationId) {
    return { ok: false, message: "Stop not found." };
  }

  // Stop state-machine guard, runs AFTER the org check so cross-org
  // probes can't read the stop's status via the rejection message:
  //   pending  → {en_route, completed, skipped}
  //   en_route → {completed, skipped, pending}  (driver retreated)
  //   completed / skipped — terminal
  // Without this, a dispatcher could flip completed → pending,
  // losing the completion timestamp and the downstream "order
  // delivered" auto-sync that fires when the stop completes.
  const currentStopStatus = (stop as unknown as { stop_status: string | null }).stop_status ?? null;
  const ALLOWED: Record<string, string[]> = {
    pending: ["en_route", "completed", "skipped"],
    en_route: ["completed", "skipped", "pending"],
    completed: [],
    skipped: [],
  };
  if (
    currentStopStatus &&
    currentStopStatus !== status &&
    !ALLOWED[currentStopStatus]?.includes(status)
  ) {
    return {
      ok: false,
      message: `Cannot move stop from "${currentStopStatus}" to "${status}".`,
    };
  }

  const resolvedOrderId = orderId ?? (stop.order_id as string | null) ?? null;

  const { error } = await supabase
    .from("route_stops")
    .update({
      stop_status: status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", stopId);

  if (error) return { ok: false, message: error.message };

  // Sync order status when a delivery stop (not pickup) is completed.
  // Direct DB update rather than updateOrderStatus() to avoid state-machine
  // failures when the order skips the scheduled/out_for_delivery steps.
  if (resolvedOrderId && status === "completed" && stop.stop_type === "delivery") {
    await supabase
      .from("orders")
      .update({ order_status: "delivered" })
      .eq("id", resolvedOrderId)
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .in("order_status", ["confirmed", "scheduled", "out_for_delivery"]);

    // Clear tracking token so expired links can't be replayed
    await supabase
      .from("route_stops")
      .update({ tracking_token_hash: null, tracking_token_expires_at: null })
      .eq("id", stopId);
  }

  // When operator marks en_route via dashboard, issue tracking token + send SMS
  // so the customer receives the same notification as when crew app or the
  // Smart Delivery Mode "Send delivery" button is used. Extracted to a
  // shared helper so all three call sites stay in sync.
  if (status === "en_route") {
    const { fireEnRouteSms } = await import("./send-en-route-sms");
    await fireEnRouteSms(supabase, ctx.organizationId, stopId);
  }

  revalidatePath(`/dashboard/deliveries/${routeId}`);
  revalidatePath("/dashboard/deliveries");
  // #366 stop completion flips order to "delivered"; operator order pages
  // and customer portal both need to refresh.
  if (status === "completed" && resolvedOrderId && stop.stop_type === "delivery") {
    revalidatePath("/dashboard/orders");
    revalidatePath(`/dashboard/orders/${resolvedOrderId}`);
    revalidatePath("/order-status");
  }
  return { ok: true, message: "Stop updated." };
}

/**
 * Wrapper around `releaseRouteStopsForCancelledOrder` (in its own module
 * so unit tests can hit the pure helper) that handles env gating, client
 * creation, and revalidation. Called from `updateOrderStatus` when an
 * order transitions to `cancelled` (decision 2.11).
 */
export async function releaseRouteStopsForCancelledOrder(
  organizationId: string,
  orderId: string
): Promise<{ removedCount: number; affectedRouteIds: string[] }> {
  if (!hasSupabaseEnv()) {
    return { removedCount: 0, affectedRouteIds: [] };
  }
  const supabase = await createSupabaseServerClient();
  const { releaseRouteStopsForCancelledOrder: helper } = await import(
    "@/lib/routes/release-stops-on-cancel"
  );
  const result = await helper(organizationId, orderId, supabase);

  for (const routeId of result.affectedRouteIds) {
    revalidatePath(`/dashboard/deliveries/${routeId}`);
  }
  if (result.removedCount > 0) revalidatePath("/dashboard/deliveries");

  return result;
}

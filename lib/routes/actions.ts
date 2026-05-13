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

  const name = String(formData.get("name") ?? "").trim();
  const routeDate = String(formData.get("route_date") ?? "").trim();
  const driverProfileId = String(formData.get("driver_profile_id") ?? "").trim() || null;
  const assignedVehicle = String(formData.get("assigned_vehicle") ?? "").trim() || null;

  if (!routeDate) return { ok: false, message: "Route date is required." };

  const supabase = await createSupabaseServerClient();
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

  const routeId = String(formData.get("route_id") ?? "");
  const orderId = String(formData.get("order_id") ?? "");
  const stopType = String(formData.get("stop_type") ?? "delivery");
  const scheduledTime = String(formData.get("scheduled_time") ?? "").trim() || null;
  const routeDate = String(formData.get("route_date") ?? "").trim();

  if (!routeId || !orderId) {
    return { ok: false, message: "Route and order are required." };
  }

  const supabase = await createSupabaseServerClient();

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

  // Derive the next sequence number from the current count of stops on this
  // route.  Using COUNT rather than MAX(stop_sequence)+1 avoids a null-handling
  // edge case when the route has no stops yet.  A true uniqueness guarantee
  // requires a DB unique constraint on (route_id, stop_sequence); that
  // migration is tracked separately.
  const { count: stopCount } = await supabase
    .from("route_stops")
    .select("id", { count: "exact", head: true })
    .eq("route_id", routeId);

  const nextSequence = (stopCount ?? 0) + 1;

  let scheduledWindowStart: string | null = null;
  if (scheduledTime && routeDate) {
    scheduledWindowStart = new Date(`${routeDate}T${scheduledTime}:00`).toISOString();
  }

  const { error } = await supabase.from("route_stops").insert({
    route_id: routeId,
    order_id: orderId,
    stop_type: stopType,
    stop_sequence: nextSequence,
    stop_status: "assigned",
    scheduled_window_start: scheduledWindowStart,
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

  const stopId = String(formData.get("stop_id") ?? "");
  const routeId = String(formData.get("route_id") ?? "");

  const supabase = await createSupabaseServerClient();

  // Verify the stop belongs to a route owned by this org before deleting
  const { data: stop } = await supabase
    .from("route_stops")
    .select("id, routes!inner(organization_id)")
    .eq("id", stopId)
    .eq("routes.organization_id", ctx.organizationId)
    .maybeSingle();

  if (!stop) return { ok: false, message: "Stop not found." };

  await supabase.from("route_stops").delete().eq("id", stopId);

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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("routes")
    .update({ route_status: status })
    .eq("id", routeId)
    .eq("organization_id", ctx.organizationId);

  if (error) return { ok: false, message: error.message };

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

  const supabase = await createSupabaseServerClient();

  // Verify the stop belongs to a route owned by this org before updating
  const { data: stop } = await supabase
    .from("route_stops")
    .select("id, routes!inner(organization_id)")
    .eq("id", stopId)
    .maybeSingle();

  if (!stop || (stop.routes as unknown as { organization_id: string }).organization_id !== ctx.organizationId) {
    return { ok: false, message: "Stop not found." };
  }

  const { error } = await supabase
    .from("route_stops")
    .update({
      stop_status: status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", stopId);

  if (error) return { ok: false, message: error.message };

  // Sync order status when delivery stop is completed
  if (orderId && status === "completed") {
    try {
      const { updateOrderStatus } = await import("@/lib/orders/actions");
      await updateOrderStatus(orderId, "delivered");
    } catch {
      // Non-fatal — stop is already marked complete
    }
  }

  revalidatePath(`/dashboard/deliveries/${routeId}`);
  revalidatePath("/dashboard/deliveries");
  return { ok: true, message: "Stop updated." };
}

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
    .select("id, stop_type, order_id, routes!inner(organization_id)")
    .eq("id", stopId)
    .maybeSingle();

  if (!stop || (stop.routes as unknown as { organization_id: string }).organization_id !== ctx.organizationId) {
    return { ok: false, message: "Stop not found." };
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
  // so the customer receives the same notification as when crew app is used.
  if (status === "en_route") {
    try {
      const { issueTrackingToken } = await import("@/lib/tracking/access-token");
      const { getSiteUrl } = await import("@/lib/site-url");
      const { sendSmsNotification } = await import("@/lib/sms/send-notification");
      const token = await issueTrackingToken({ supabase, stopId });
      const siteUrl = await getSiteUrl();
      const trackingUrl = `${siteUrl}/track/${token}`;

      const { data: stopWithOrder } = await supabase
        .from("route_stops")
        .select("orders!inner(id, order_number, customer_id, customers!inner(phone, first_name, sms_opt_in))")
        .eq("id", stopId)
        .maybeSingle();

      if (stopWithOrder) {
        const order = (stopWithOrder as unknown as {
          orders: { id: string; order_number: string; customer_id: string; customers: { phone: string; first_name: string; sms_opt_in: boolean } };
        }).orders;
        const customer = order?.customers;
        if (customer?.phone && customer?.sms_opt_in) {
          const { data: org } = await supabase.from("organizations").select("name").eq("id", ctx.organizationId).is("deleted_at", null).maybeSingle();
          await sendSmsNotification("deliveryEnRoute", customer.phone, {
            orderNumber: order.order_number,
            eta: "shortly",
            businessName: org?.name ?? "Your delivery",
            trackingUrl,
          }, ctx.organizationId, { orderId: order.id, customerId: order.customer_id });
        }
      }
    } catch (err) {
      console.error("[routes] Failed to issue tracking token or send SMS:", err);
    }
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

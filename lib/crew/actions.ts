"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";
import { issueTrackingToken } from "@/lib/tracking/access-token";
import { getSiteUrl } from "@/lib/site-url";
import { sniffImageType } from "@/lib/utils/image-signature";
import { sendSmsNotification } from "@/lib/sms/send-notification";

export type StopActionState = {
  ok: boolean;
  message: string;
};

export async function updateStopStatus(
  stopId: string,
  newStatus: string
): Promise<StopActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo mode: Stop would be marked ${newStatus}.` };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

  // Verify the stop belongs to this organization via the parent route
  const [{ data: stop }, { data: membership }] = await Promise.all([
    supabase
      .from("route_stops")
      .select("route_id, stop_type, order_id, routes!inner(organization_id, assigned_driver_profile_id)")
      .eq("id", stopId)
      .maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", ctx.organizationId)
      .eq("profile_id", ctx.userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const routeData = stop?.routes as unknown as { organization_id: string; assigned_driver_profile_id: string | null } | undefined;
  if (!stop || routeData?.organization_id !== ctx.organizationId) {
    return { ok: false, message: "Stop not found." };
  }

  // Positive allowlist — viewer (and any unknown role) cannot mutate stops.
  // Crew members additionally must be assigned to this route.
  const role = membership?.role ?? "";
  if (!["owner", "admin", "dispatcher", "crew"].includes(role)) {
    return { ok: false, message: "You don't have permission to update this stop." };
  }
  if (role === "crew" && routeData.assigned_driver_profile_id !== ctx.userId) {
    return { ok: false, message: "You are not assigned to this route." };
  }

  const VALID_STOP_STATUSES = ["pending", "en_route", "completed", "skipped"];
  if (!VALID_STOP_STATUSES.includes(newStatus)) {
    return { ok: false, message: "Invalid stop status." };
  }

  const updateData: Record<string, unknown> = { stop_status: newStatus };
  if (newStatus === "completed") {
    updateData.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("route_stops")
    .update(updateData)
    .eq("id", stopId);

  if (error) {
    return { ok: false, message: error.message };
  }

  // If stop is completed, check if all stops on route are done → update route status
  if (newStatus === "completed") {
    // Skipped stops are "done" for the purpose of route completion — leaving
    // them out of the "remaining" set would block the route from ever
    // auto-completing whenever a single stop was skipped.
    const { data: remaining } = await supabase
      .from("route_stops")
      .select("id")
      .eq("route_id", stop.route_id)
      .not("stop_status", "in", "(completed,skipped)");

    if (remaining && remaining.length === 0) {
      // Don't flip a route that's already terminal (cancelled/completed) back
      // to a non-current state via the auto-promotion path.
      await supabase
        .from("routes")
        .update({ route_status: "completed" })
        .eq("id", stop.route_id)
        .in("route_status", ["planned", "in_progress"]);
    }

    // Sync order status when a delivery stop (not pickup) is completed.
    // Direct DB update rather than updateOrderStatus() to avoid operator-session
    // auth checks and rate limiting; org isolation is already enforced above via
    // the routes!inner join check.
    const stopOrderId = stop.order_id as string | null;
    let didFlipToDelivered = false;
    if (stopOrderId && stop.stop_type === "delivery") {
      const { data: flipped } = await supabase
        .from("orders")
        .update({ order_status: "delivered" })
        .eq("id", stopOrderId)
        .eq("organization_id", ctx.organizationId)
        .is("deleted_at", null)
        .in("order_status", ["confirmed", "scheduled", "out_for_delivery"])
        .select("id");
      didFlipToDelivered = !!(flipped && flipped.length > 0);
    }

    // #340 The operator flow (updateOrderStatus) fires triggerOrderStatusEmail
    // and the delivery SMS on "delivered" — the crew flow used to skip both
    // entirely so the customer never knew the rental was complete. Mirror
    // the operator behavior here.
    if (didFlipToDelivered && stopOrderId) {
      try {
        const { triggerOrderStatusEmail } = await import("@/lib/email/triggers");
        await triggerOrderStatusEmail({
          organizationId: ctx.organizationId,
          orderId: stopOrderId,
          newStatus: "delivered",
        });
      } catch (err) {
        console.error("[crew] delivered email failed for", stopOrderId, err instanceof Error ? err.message : err);
      }

      try {
        const { sendSmsNotification } = await import("@/lib/sms/send-notification");
        const { data: deliveredOrder } = await supabase
          .from("orders")
          .select("order_number, customer_id")
          .eq("id", stopOrderId)
          .eq("organization_id", ctx.organizationId)
          .is("deleted_at", null)
          .maybeSingle();
        if (deliveredOrder?.customer_id) {
          const { data: deliveredCustomer } = await supabase
            .from("customers")
            .select("phone, sms_opt_in")
            .eq("id", deliveredOrder.customer_id)
            .is("deleted_at", null)
            .maybeSingle();
          if (deliveredCustomer?.phone && deliveredCustomer?.sms_opt_in) {
            const { data: org } = await supabase
              .from("organizations")
              .select("name")
              .eq("id", ctx.organizationId)
              .is("deleted_at", null)
              .maybeSingle();
            await sendSmsNotification("deliveryCompleted", deliveredCustomer.phone, {
              orderNumber: deliveredOrder.order_number,
              businessName: org?.name ?? "Your rental company",
            }, ctx.organizationId, { orderId: stopOrderId, customerId: deliveredOrder.customer_id });
          }
        }
      } catch (err) {
        console.error("[crew] delivered SMS failed for", stopOrderId, err instanceof Error ? err.message : err);
      }
    }

    // Clear tracking token so the link can't be replayed after delivery
    await supabase
      .from("route_stops")
      .update({ tracking_token_hash: null, tracking_token_expires_at: null })
      .eq("id", stopId);
  }

  // If stop is en_route or in_progress, set route to in_progress
  if (newStatus === "en_route" || newStatus === "in_progress") {
    await supabase
      .from("routes")
      .update({ route_status: "in_progress" })
      .eq("id", stop.route_id);
  }

  // Issue tracking token and send SMS when driver marks en_route.
  // Must be awaited — fire-and-forget is terminated by Vercel Lambda before completion.
  if (newStatus === "en_route") {
    try {
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
          orders: {
            id: string;
            order_number: string;
            customer_id: string;
            customers: { phone: string; first_name: string; sms_opt_in: boolean };
          };
        }).orders;
        const customer = order?.customers;
        if (customer?.phone && customer?.sms_opt_in) {
          const { data: org } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", ctx.organizationId)
            .is("deleted_at", null)
            .maybeSingle();
          await sendSmsNotification(
            "deliveryEnRoute",
            customer.phone,
            {
              orderNumber: order.order_number,
              eta: "shortly",
              businessName: org?.name ?? "Your delivery",
              trackingUrl,
            },
            ctx.organizationId,
            { orderId: order.id, customerId: order.customer_id }
          );
        }
      }
    } catch (err) {
      console.error("[Tracking] Failed to issue token or send SMS:", err);
    }
  }

  revalidatePath("/crew/today");
  revalidatePath("/dashboard/deliveries");
  revalidatePath(`/dashboard/deliveries/${stop.route_id}`);
  // When the stop flipped an order to "delivered" above, the operator order
  // pages and the customer portal both need to refresh.
  if (newStatus === "completed" && stop.order_id && stop.stop_type === "delivery") {
    revalidatePath("/dashboard/orders");
    revalidatePath(`/dashboard/orders/${stop.order_id}`);
    revalidatePath("/order-status");
  }

  return { ok: true, message: `Stop marked as ${newStatus.replace(/_/g, " ")}.` };
}

export async function uploadProofPhoto(
  _prev: StopActionState,
  formData: FormData
): Promise<StopActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: photo would be saved." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const stopId = String(formData.get("stop_id") ?? "");
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a photo first." };
  }

  const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_PHOTO_SIZE = 20 * 1024 * 1024; // 20 MB — allow large mobile photos

  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { ok: false, message: "Only JPEG, PNG, or WebP photos are allowed." };
  }

  // Verify the actual file bytes, not just the (forgeable) declared type.
  const sniffedPhotoType = await sniffImageType(file);
  if (!sniffedPhotoType || !ALLOWED_PHOTO_TYPES.includes(sniffedPhotoType)) {
    return { ok: false, message: "File content doesn't match a supported image format." };
  }

  if (file.size > MAX_PHOTO_SIZE) {
    return { ok: false, message: "Photo must be under 20 MB." };
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: stop }, { data: photoMembership }] = await Promise.all([
    supabase
      .from("route_stops")
      .select("route_id, routes!inner(organization_id, assigned_driver_profile_id)")
      .eq("id", stopId)
      .maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", ctx.organizationId)
      .eq("profile_id", ctx.userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const photoRouteData = stop?.routes as unknown as { organization_id: string; assigned_driver_profile_id: string | null } | undefined;
  if (!stop || photoRouteData?.organization_id !== ctx.organizationId) {
    return { ok: false, message: "Stop not found." };
  }

  const photoRole = photoMembership?.role ?? "";
  if (!["owner", "admin", "dispatcher", "crew"].includes(photoRole)) {
    return { ok: false, message: "You don't have permission to upload proof photos." };
  }
  if (photoRole === "crew" && photoRouteData.assigned_driver_profile_id !== ctx.userId) {
    return { ok: false, message: "You are not assigned to this route." };
  }

  const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  const ext = MIME_TO_EXT[file.type] ?? "jpg";

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET || "uploads";
  const filePath = `proof-photos/${ctx.organizationId}/${stopId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

  const { error: dbError } = await supabase
    .from("route_stops")
    .update({ proof_photo_url: urlData.publicUrl })
    .eq("id", stopId);

  if (dbError) {
    // Storage file is now orphaned but that is recoverable manually; surface the
    // error so the crew member doesn't assume the photo was saved.
    return { ok: false, message: "Photo uploaded but could not be linked to stop. Please try again." };
  }

  revalidatePath("/crew/today");
  return { ok: true, message: "Photo saved." };
}

export async function saveSignature(
  _prev: StopActionState,
  formData: FormData
): Promise<StopActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: signature would be saved." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const stopId = String(formData.get("stop_id") ?? "");
  const signerName = String(formData.get("signer_name") ?? "").trim();

  if (!signerName) return { ok: false, message: "Customer name is required." };
  if (signerName.length > 200) return { ok: false, message: "Signer name is too long." };

  const supabase = await createSupabaseServerClient();

  const [{ data: stop }, { data: sigMembership }] = await Promise.all([
    supabase
      .from("route_stops")
      .select("route_id, routes!inner(organization_id, assigned_driver_profile_id)")
      .eq("id", stopId)
      .maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", ctx.organizationId)
      .eq("profile_id", ctx.userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const sigRouteData = stop?.routes as unknown as { organization_id: string; assigned_driver_profile_id: string | null } | undefined;
  if (!stop || sigRouteData?.organization_id !== ctx.organizationId) {
    return { ok: false, message: "Stop not found." };
  }

  const sigRole = sigMembership?.role ?? "";
  if (!["owner", "admin", "dispatcher", "crew"].includes(sigRole)) {
    return { ok: false, message: "You don't have permission to save signatures." };
  }
  if (sigRole === "crew" && sigRouteData.assigned_driver_profile_id !== ctx.userId) {
    return { ok: false, message: "You are not assigned to this route." };
  }

  const { error: sigError } = await supabase
    .from("route_stops")
    .update({ signature_name: `${signerName} — ${new Date().toISOString()}` })
    .eq("id", stopId);

  if (sigError) return { ok: false, message: "Failed to save signature." };

  revalidatePath("/crew/today");
  return { ok: true, message: `Signature saved for ${signerName}.` };
}

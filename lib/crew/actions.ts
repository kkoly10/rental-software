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

  const VALID_STOP_STATUSES = ["pending", "en_route", "completed", "skipped"];
  if (!VALID_STOP_STATUSES.includes(newStatus)) {
    return { ok: false, message: "Invalid stop status." };
  }

  const supabase = await createSupabaseServerClient();

  // Atomic via crew_update_stop_status RPC: the role check, the
  // assignment check, and the UPDATE all run inside one Postgres
  // transaction with a row lock on the parent route. Previously these
  // were three separate round-trips, so a dispatcher reassigning the
  // route between the SELECT and the UPDATE could leave a now-
  // unassigned crew member completing a stop.
  const { data: rpcRows, error } = await supabase.rpc("crew_update_stop_status", {
    p_stop_id: stopId,
    p_org_id: ctx.organizationId,
    p_user_id: ctx.userId,
    p_new_status: newStatus,
  });

  if (error) {
    return { ok: false, message: "Couldn't update the stop." };
  }

  const result = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
    | { ok: boolean; reason: string | null; route_id: string | null; order_id: string | null; stop_type: string | null; flipped_to_delivered: boolean | null }
    | null;

  if (!result?.ok) {
    if (result?.reason === "not_assigned") {
      return { ok: false, message: "You are not assigned to this route." };
    }
    if (result?.reason === "not_authorized") {
      return { ok: false, message: "You don't have permission to update this stop." };
    }
    return { ok: false, message: "Stop not found." };
  }

  // Re-shape the post-RPC values to match the rest of the function.
  const stop = {
    route_id: result.route_id!,
    order_id: result.order_id,
    stop_type: result.stop_type,
  };

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

    // Sync order status when a delivery stop is completed. The flip to
    // "delivered" now happens inside crew_update_stop_status() (same condition,
    // same atomicity), so crew need no direct write access to `orders` — the
    // table's RLS write policy excludes crew. We just read back the flag.
    const stopOrderId = stop.order_id as string | null;
    const didFlipToDelivered = !!result.flipped_to_delivered;

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

  // If stop is en_route or in_progress, set route to in_progress —
  // but ONLY if the route is currently planned. Without the
  // route_status filter, a stop transition could silently revert a
  // route that's already been marked completed (e.g. by a dispatcher
  // wrapping up the day) back to in_progress.
  if (newStatus === "en_route" || newStatus === "in_progress") {
    await supabase
      .from("routes")
      .update({ route_status: "in_progress" })
      .eq("id", stop.route_id)
      .in("route_status", ["planned"]);
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

  // Validate stopId is a UUID before interpolating into the storage path.
  // Without this, a crafted stop_id form value like "../../foo" would write
  // to an attacker-chosen location in the uploads bucket.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stopId)) {
    return { ok: false, message: "Invalid stop reference." };
  }

  const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  // Use the sniffed type, not the client-declared file.type: a request can
  // forge file.type="image/jpeg" while sending PNG bytes (or vice versa).
  // The sniff has already validated the bytes against ALLOWED_PHOTO_TYPES
  // above, so it's the trusted source for both the extension and the
  // Content-Type header below.
  const ext = MIME_TO_EXT[sniffedPhotoType] ?? "jpg";

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET || "uploads";
  const filePath = `proof-photos/${ctx.organizationId}/${stopId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { cacheControl: "3600", upsert: false, contentType: sniffedPhotoType });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  // Atomic via crew_attach_proof_photo RPC. The role check, the
  // assignment check, and the route_stops UPDATE all run inside one
  // Postgres transaction with a row lock on the parent route — so a
  // dispatcher reassignment between auth check and UPDATE can't let
  // an unassigned crew member's photo land on the wrong route.
  // #62: store the storage PATH, not a public URL — the uploads bucket
  // is private, so public URLs 400; renders sign the path on read.
  const { data: rpcRows, error: rpcError } = await supabase.rpc("crew_attach_proof_photo", {
    p_stop_id: stopId,
    p_org_id: ctx.organizationId,
    p_user_id: ctx.userId,
    p_photo_url: filePath,
  });

  if (rpcError) {
    await supabase.storage.from(bucket).remove([filePath]);
    return { ok: false, message: "Photo uploaded but could not be linked to stop. Please try again." };
  }

  const result = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
    | { ok: boolean; reason: string | null }
    | null;

  if (!result?.ok) {
    // Authorization failed — clean up the orphaned upload.
    await supabase.storage.from(bucket).remove([filePath]);
    if (result?.reason === "not_assigned") {
      return { ok: false, message: "You are not assigned to this route." };
    }
    if (result?.reason === "not_authorized") {
      return { ok: false, message: "You don't have permission to upload proof photos." };
    }
    return { ok: false, message: "Stop not found." };
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

  // Atomic via crew_attach_signature RPC. Same TOCTOU-closing pattern
  // as updateStopStatus + uploadProofPhoto — role check, assignment
  // check, and UPDATE all in one transaction with a row lock on the
  // parent route.
  const signerLabel = `${signerName} — ${new Date().toISOString()}`;
  const { data: rpcRows, error: rpcError } = await supabase.rpc("crew_attach_signature", {
    p_stop_id: stopId,
    p_org_id: ctx.organizationId,
    p_user_id: ctx.userId,
    p_signer_name: signerLabel,
  });

  if (rpcError) return { ok: false, message: "Failed to save signature." };

  const result = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
    | { ok: boolean; reason: string | null }
    | null;

  if (!result?.ok) {
    if (result?.reason === "not_assigned") {
      return { ok: false, message: "You are not assigned to this route." };
    }
    if (result?.reason === "not_authorized") {
      return { ok: false, message: "You don't have permission to save signatures." };
    }
    return { ok: false, message: "Stop not found." };
  }

  revalidatePath("/crew/today");
  return { ok: true, message: `Signature saved for ${signerName}.` };
}

/**
 * Sprint 5.5 — pickup-side variant of uploadProofPhoto.
 *
 * Same shape, same RPC pattern, just writes route_stops.pickup_photo_url
 * instead of proof_photo_url. The two columns together form the
 * before/after pair that powers the Equipment Condition card on the
 * order detail page + the customer portal.
 *
 * Like its delivery sibling, this is optional — the crew can complete
 * a pickup stop without uploading. Most operators will encourage but
 * not require capture; the strategic value is having *something* on
 * file, not forensic-grade evidence.
 */
export async function uploadPickupPhoto(
  _prev: StopActionState,
  formData: FormData,
): Promise<StopActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: pickup photo would be saved." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const stopId = String(formData.get("stop_id") ?? "");
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a photo first." };
  }

  // Same allowed-type list as uploadProofPhoto so behavior is
  // identical across delivery + pickup. Diverging would create
  // surprises for crews that captured a HEIC for delivery and a JPEG
  // for pickup (or vice versa).
  const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_PHOTO_SIZE = 20 * 1024 * 1024;

  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { ok: false, message: "Only JPEG, PNG, or WebP photos are allowed." };
  }

  const sniffedPhotoType = await sniffImageType(file);
  if (!sniffedPhotoType || !ALLOWED_PHOTO_TYPES.includes(sniffedPhotoType)) {
    return { ok: false, message: "File content doesn't match a supported image format." };
  }

  if (file.size > MAX_PHOTO_SIZE) {
    return { ok: false, message: "Photo must be under 20 MB." };
  }

  const supabase = await createSupabaseServerClient();

  // Same hardening as uploadProofPhoto: UUID-validate stopId so it can't
  // path-traverse, and derive extension + content-type from the sniffed
  // bytes (not the forgeable client-declared file.type).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stopId)) {
    return { ok: false, message: "Invalid stop reference." };
  }
  const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = MIME_TO_EXT[sniffedPhotoType] ?? "jpg";
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET || "uploads";
  // Different prefix from proof-photos so listings stay tidy and an
  // operator browsing storage can tell delivery vs pickup at a glance.
  const filePath = `pickup-photos/${ctx.organizationId}/${stopId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: sniffedPhotoType,
    });
  if (uploadError) return { ok: false, message: uploadError.message };

  // #62: store the storage PATH (see uploadProofPhoto above).
  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    "crew_attach_pickup_photo",
    {
      p_stop_id: stopId,
      p_org_id: ctx.organizationId,
      p_user_id: ctx.userId,
      p_photo_url: filePath,
    },
  );

  if (rpcError) {
    await supabase.storage.from(bucket).remove([filePath]);
    return {
      ok: false,
      message: "Photo uploaded but could not be linked to stop. Please try again.",
    };
  }

  const result = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
    | { ok: boolean; reason: string | null }
    | null;

  if (!result?.ok) {
    await supabase.storage.from(bucket).remove([filePath]);
    if (result?.reason === "not_assigned") {
      return { ok: false, message: "You are not assigned to this route." };
    }
    if (result?.reason === "not_authorized") {
      return { ok: false, message: "You don't have permission to upload pickup photos." };
    }
    return { ok: false, message: "Stop not found." };
  }

  revalidatePath("/crew/today");
  return { ok: true, message: "Pickup photo saved." };
}

/**
 * Sprint 5.5 — pickup-side variant of saveSignature. Same pattern as
 * uploadPickupPhoto: mirror of the delivery action, atomic via the
 * crew_attach_pickup_signature RPC.
 */
export async function savePickupSignature(
  _prev: StopActionState,
  formData: FormData,
): Promise<StopActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: pickup signature would be saved." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const stopId = String(formData.get("stop_id") ?? "");
  const signerName = String(formData.get("signer_name") ?? "").trim();

  if (!signerName) return { ok: false, message: "Customer name is required." };
  if (signerName.length > 200) return { ok: false, message: "Signer name is too long." };

  const supabase = await createSupabaseServerClient();
  const signerLabel = `${signerName} — ${new Date().toISOString()}`;
  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    "crew_attach_pickup_signature",
    {
      p_stop_id: stopId,
      p_org_id: ctx.organizationId,
      p_user_id: ctx.userId,
      p_signer_name: signerLabel,
    },
  );

  if (rpcError) return { ok: false, message: "Failed to save pickup signature." };

  const result = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
    | { ok: boolean; reason: string | null }
    | null;

  if (!result?.ok) {
    if (result?.reason === "not_assigned") {
      return { ok: false, message: "You are not assigned to this route." };
    }
    if (result?.reason === "not_authorized") {
      return { ok: false, message: "You don't have permission to save signatures." };
    }
    return { ok: false, message: "Stop not found." };
  }

  revalidatePath("/crew/today");
  return { ok: true, message: `Pickup signature saved for ${signerName}.` };
}

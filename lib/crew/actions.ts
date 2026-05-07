"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";
import { issueTrackingToken } from "@/lib/tracking/access-token";
import { getSiteUrl } from "@/lib/site-url";
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
  const { data: stop } = await supabase
    .from("route_stops")
    .select("route_id, routes!inner(organization_id)")
    .eq("id", stopId)
    .maybeSingle();

  if (!stop || (stop.routes as unknown as { organization_id: string }).organization_id !== ctx.organizationId) {
    return { ok: false, message: "Stop not found." };
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
    const { data: remaining } = await supabase
      .from("route_stops")
      .select("id")
      .eq("route_id", stop.route_id)
      .neq("stop_status", "completed");

    if (remaining && remaining.length === 0) {
      await supabase
        .from("routes")
        .update({ route_status: "completed" })
        .eq("id", stop.route_id);
    }
  }

  // If stop is en_route or in_progress, set route to in_progress
  if (newStatus === "en_route" || newStatus === "in_progress") {
    await supabase
      .from("routes")
      .update({ route_status: "in_progress" })
      .eq("id", stop.route_id);
  }

  // Issue tracking token and send SMS when driver marks en_route
  if (newStatus === "en_route") {
    (async () => {
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
          if (customer?.phone) {
            const { data: org } = await supabase
              .from("organizations")
              .select("name")
              .eq("id", ctx.organizationId)
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
    })();
  }

  revalidatePath("/crew/today");
  revalidatePath("/dashboard/deliveries");

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

  const supabase = await createSupabaseServerClient();

  const { data: stop } = await supabase
    .from("route_stops")
    .select("route_id, routes!inner(organization_id)")
    .eq("id", stopId)
    .maybeSingle();

  if (!stop || (stop.routes as unknown as { organization_id: string }).organization_id !== ctx.organizationId) {
    return { ok: false, message: "Stop not found." };
  }

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";
  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `proof-photos/${ctx.organizationId}/${stopId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { cacheControl: "3600", upsert: true, contentType: file.type });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

  await supabase
    .from("route_stops")
    .update({ proof_photo_url: urlData.publicUrl })
    .eq("id", stopId);

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

  const supabase = await createSupabaseServerClient();

  const { data: stop } = await supabase
    .from("route_stops")
    .select("route_id, routes!inner(organization_id)")
    .eq("id", stopId)
    .maybeSingle();

  if (!stop || (stop.routes as unknown as { organization_id: string }).organization_id !== ctx.organizationId) {
    return { ok: false, message: "Stop not found." };
  }

  await supabase
    .from("route_stops")
    .update({ signature_name: `${signerName} — ${new Date().toLocaleString()}` })
    .eq("id", stopId);

  revalidatePath("/crew/today");
  return { ok: true, message: `Signature saved for ${signerName}.` };
}

"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { hashPortalAccessToken, isPortalTokenExpired } from "@/lib/portal/access-token";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getActionClientKey } from "@/lib/security/action-client";
import { blockDemoWrites } from "@/lib/demo/guard";
import { revalidatePath } from "next/cache";

export type AcceptQuoteState = { ok: boolean; message: string };

export async function acceptQuote(
  _prev: AcceptQuoteState,
  formData: FormData
): Promise<AcceptQuoteState> {
  const token = String(formData.get("portal_token") ?? "").trim();
  if (!token) return { ok: false, message: "Invalid portal link." };

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Quote accepted." };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) return { ok: false, message: "Service unavailable." };

  const demoCheck = await blockDemoWrites(orgId);
  if (demoCheck.blocked) return { ok: false, message: demoCheck.message };

  try {
    const clientKey = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "portal:accept-quote:client",
      actor: clientKey,
      limit: 10,
      windowSeconds: 300,
      strict: true,
    });
    if (!limit.allowed) {
      return { ok: false, message: "Too many attempts. Please wait a moment." };
    }
  } catch {
    return { ok: false, message: "Unable to process right now." };
  }

  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();
  const tokenHash = hashPortalAccessToken(token);

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_status, portal_access_token_created_at, order_number, product_id, event_date, event_start_time, event_end_time, rental_end_date, customer_id")
    .eq("organization_id", orgId)
    .eq("portal_access_token_hash", tokenHash)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) return { ok: false, message: "Order not found." };
  if (isPortalTokenExpired(order.portal_access_token_created_at)) {
    return { ok: false, message: "This portal link has expired. Contact us for a new one." };
  }

  if (order.order_status !== "quote_sent") {
    return { ok: false, message: "This quote has already been actioned or is no longer pending." };
  }

  const { error } = await supabase
    .from("orders")
    .update({ order_status: "awaiting_deposit" })
    .eq("id", order.id)
    .eq("order_status", "quote_sent");

  if (error) return { ok: false, message: "Failed to accept quote. Please try again." };

  // Reserve inventory so this date/product can't be double-booked
  if (order.product_id && order.event_date) {
    try {
      const { reserveProductAvailabilityBlock } = await import("@/lib/availability/blocks");
      // event_start_time/event_end_time are full timestamps; the window builder
      // expects HH:MM, so derive that (in UTC, matching how they were stored).
      const toHHMM = (ts: string | null) => {
        if (!ts) return null;
        const d = new Date(ts);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(11, 16);
      };
      await reserveProductAvailabilityBlock({
        organizationId: orgId,
        productId: order.product_id,
        orderId: order.id,
        eventDate: order.event_date,
        startTime: toHHMM(order.event_start_time),
        endTime: toHHMM(order.event_end_time),
        rentalEndDate: order.rental_end_date,
        source: "dashboard", // permanent hold — no expiry
      });
    } catch {
      // Non-fatal: log but don't block the customer flow; operator can review manually
      console.error("[accept-quote] Failed to create availability block for order", order.id);
    }
  }

  // Notify operator
  try {
    const { createNotification } = await import("@/lib/data/notifications");
    await createNotification(
      orgId,
      "order_confirmed",
      "Quote accepted by customer",
      `Order #${order.order_number} — deposit payment required`,
      `/dashboard/orders/${order.id}`
    );
  } catch { /* non-critical */ }

  // Send customer confirmation email with portal link to pay deposit
  try {
    const { triggerOrderStatusEmail } = await import("@/lib/email/triggers");
    await triggerOrderStatusEmail({
      organizationId: orgId,
      orderId: order.id,
      newStatus: "awaiting_deposit",
    });
  } catch { /* non-critical */ }

  // Revalidate dashboard so operator sees updated status immediately
  revalidatePath("/order-status");
  revalidatePath(`/dashboard/orders/${order.id}`);
  revalidatePath("/dashboard/orders");
  // #373 home tile/counters and storefront availability also need refresh
  revalidatePath("/dashboard");
  revalidatePath("/inventory", "layout");

  return { ok: true, message: "Quote accepted! Please pay your deposit to confirm your booking." };
}

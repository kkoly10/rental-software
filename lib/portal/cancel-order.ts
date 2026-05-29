"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { blockDemoWrites } from "@/lib/demo/guard";
import { hashPortalAccessToken, isPortalTokenExpired } from "@/lib/portal/access-token";
import { logAppError } from "@/lib/observability/server";

export type CancelOrderState = { ok: boolean; message: string };

// Statuses where the customer is not allowed to self-cancel via the portal —
// anything that's already in delivery or beyond should require operator action.
const PORTAL_CANCELLABLE = new Set([
  "inquiry",
  "quote_sent",
  "awaiting_deposit",
  "confirmed",
]);

export async function cancelOrderFromPortal(
  _prev: CancelOrderState,
  formData: FormData
): Promise<CancelOrderState> {
  const portalToken = String(formData.get("portal_token") ?? "").trim();
  if (!portalToken) return { ok: false, message: "Invalid portal access." };

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Booking would be cancelled." };
  }

  try {
    const clientKey = await getActionClientKey();
    const [clientLimit, tokenLimit] = await Promise.all([
      enforceRateLimit({
        scope: "portal:cancel:client",
        actor: clientKey,
        limit: 5,
        windowSeconds: 600,
        strict: true,
      }),
      enforceRateLimit({
        scope: "portal:cancel:token",
        actor: hashPortalAccessToken(portalToken),
        limit: 3,
        windowSeconds: 600,
        strict: true,
      }),
    ]);
    if (!clientLimit.allowed || !tokenLimit.allowed) {
      return { ok: false, message: "Too many attempts. Please wait a moment." };
    }
  } catch {
    return { ok: false, message: "Unable to process your request right now." };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) return { ok: false, message: "Service not available." };

  const demoCheck = await blockDemoWrites(orgId);
  if (demoCheck.blocked) {
    return { ok: false, message: demoCheck.message };
  }

  // Same anon-RLS issue as the rest of lib/portal/* — customer is anonymous,
  // RLS blocks SELECT on orders. Admin with explicit org_id filter.
  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  const tokenHash = hashPortalAccessToken(portalToken);
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_status, portal_access_token_created_at")
    .eq("organization_id", orgId)
    .eq("portal_access_token_hash", tokenHash)
    .is("deleted_at", null)
    .maybeSingle();
  if (!order) {
    return { ok: false, message: "Invalid portal access. Please reopen your portal link." };
  }
  if (isPortalTokenExpired(order.portal_access_token_created_at)) {
    return { ok: false, message: "This portal link has expired. Contact us for a new one." };
  }

  if (!PORTAL_CANCELLABLE.has(order.order_status)) {
    return {
      ok: false,
      message:
        "This booking can no longer be cancelled from the portal. Please contact us directly to cancel.",
    };
  }

  // TOCTOU guard — same pattern as updateOrderStatus.
  const { data: updated, error } = await supabase
    .from("orders")
    .update({ order_status: "cancelled" })
    .eq("id", order.id)
    .eq("organization_id", orgId)
    .eq("order_status", order.order_status)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    console.error("[portal.cancel] update failed:", error.message);
    return { ok: false, message: "We couldn't cancel your booking right now. Please try again or contact us." };
  }
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      message: "This booking's status just changed. Please reload to see the latest state.",
    };
  }

  // Release availability blocks so the slot is immediately re-bookable.
  try {
    const { releaseOrderAvailability } = await import("@/lib/availability/actions");
    await releaseOrderAvailability(orgId, order.id);
  } catch (err) {
    await logAppError({
      organizationId: orgId,
      source: "portal.cancel.release_availability",
      message: "Failed to release availability after portal cancel",
      context: { orderId: order.id, reason: err instanceof Error ? err.message : String(err) },
    });
  }

  // Trigger the customer-facing cancellation email (round-5 #353 wired
  // refunded/cancelled into EMAIL_WORTHY_STATUSES) — the cron flow already
  // proved this template works end-to-end.
  try {
    const { triggerOrderStatusEmail } = await import("@/lib/email/triggers");
    await triggerOrderStatusEmail({
      organizationId: orgId,
      orderId: order.id,
      newStatus: "cancelled",
    });
  } catch (err) {
    console.error("[portal.cancel] status email failed:", err instanceof Error ? err.message : err);
  }

  revalidatePath("/order-status");
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${order.id}`);
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/inventory", "layout");

  return { ok: true, message: "Your booking has been cancelled. We've sent you a confirmation email." };
}

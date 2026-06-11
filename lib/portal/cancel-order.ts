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
    .select(
      "id, order_status, portal_access_token_created_at, order_number, event_date, customers(first_name, last_name)"
    )
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

  // PR-2b — per-vertical cancellation policy + auto-refund.
  //
  // The vertical (via the order's first rental item → product →
  // category) sets the refund window and forfeit: a tent cancelled
  // 5 days out forfeits 50% of the deposit, a bouncer cancelled the
  // same way refunds in full. When a Stripe deposit was captured,
  // the computed refund is issued automatically through the shared
  // refund core (connected-account routing + ledger insert). Cash
  // deposits stay an operator-side conversation — nothing to wire.
  //
  // Failures here never un-cancel the order: the cancellation stands
  // and the operator sees the logged error + an un-refunded deposit
  // on the order page, which the manual Refund button can fix.
  let refundNote = "";
  try {
    const { hasStripeEnv } = await import("@/lib/stripe/config");
    if (hasStripeEnv()) {
      const { data: depositRow } = await supabase
        .from("payments")
        .select("amount")
        .eq("order_id", order.id)
        .eq("provider", "stripe")
        .eq("payment_type", "deposit")
        .eq("payment_status", "paid")
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const depositPaid = Number(depositRow?.amount ?? 0);

      if (depositPaid > 0) {
        const { data: item } = await supabase
          .from("order_items")
          .select("products(categories(vertical))")
          .eq("order_id", order.id)
          .eq("line_type", "rental")
          .limit(1)
          .maybeSingle();
        const productsJoin = (item as { products?: unknown } | null)?.products;
        const productRow = Array.isArray(productsJoin) ? productsJoin[0] : productsJoin;
        const categoryJoin = (productRow as { categories?: unknown } | null)?.categories;
        const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] : categoryJoin;
        const verticalSlug =
          typeof (categoryRow as { vertical?: unknown } | null)?.vertical === "string"
            ? ((categoryRow as { vertical: string }).vertical)
            : null;

        const { resolveVerticalPolicies, computeCancellationOutcome } = await import(
          "@/lib/verticals/policies"
        );
        const outcome = computeCancellationOutcome({
          depositPaid,
          eventDate: (order as { event_date?: string | null }).event_date ?? null,
          policies: resolveVerticalPolicies(verticalSlug),
        });

        if (outcome.refundAmount > 0) {
          const { executeStripeRefundForOrder } = await import("@/lib/payments/refund-core");
          const refund = await executeStripeRefundForOrder(supabase, {
            organizationId: orgId,
            orderId: order.id,
            amount: outcome.refundAmount,
            reason:
              outcome.forfeitAmount > 0
                ? `Customer self-cancel inside the cancellation window — $${outcome.forfeitAmount.toFixed(2)} deposit forfeited per policy`
                : "Customer self-cancel — full deposit refund per policy",
            source: "portal_cancel",
          });
          if (refund.ok) {
            refundNote =
              outcome.forfeitAmount > 0
                ? ` Your deposit refund of $${outcome.refundAmount.toFixed(2)} is on its way ($${outcome.forfeitAmount.toFixed(2)} was retained under the cancellation policy).`
                : ` Your deposit of $${outcome.refundAmount.toFixed(2)} will be refunded to your card.`;
          } else {
            refundNote = " Your deposit refund will be processed by the operator shortly.";
          }
        } else if (outcome.forfeitAmount > 0) {
          refundNote = " Per the cancellation policy, the deposit for this booking is non-refundable this close to the event.";
        }
      }
    }
  } catch (err) {
    await logAppError({
      organizationId: orgId,
      source: "portal.cancel.auto_refund",
      message: "Cancellation auto-refund failed (order remains cancelled)",
      context: { orderId: order.id, reason: err instanceof Error ? err.message : String(err) },
    });
    refundNote = " Your deposit refund will be processed by the operator shortly.";
  }

  // Trigger the customer-facing cancellation email (round-5 #353 wired
  // refunded/cancelled into EMAIL_WORTHY_STATUSES) — the cron flow already
  // proved this template works end-to-end.
  try {
    const { triggerOrderStatusEmail, triggerOperatorActivityAlertEmail } =
      await import("@/lib/email/triggers");
    await triggerOrderStatusEmail({
      organizationId: orgId,
      orderId: order.id,
      newStatus: "cancelled",
    });
    const cust = (order as unknown as {
      customers?: { first_name?: string | null; last_name?: string | null } | null;
    }).customers;
    await triggerOperatorActivityAlertEmail({
      organizationId: orgId,
      orderId: order.id,
      orderNumber: (order as { order_number?: string | null }).order_number ?? order.id,
      customerName:
        `${cust?.first_name ?? ""} ${cust?.last_name ?? ""}`.trim() || "Customer",
      event: "order_cancelled",
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

  return {
    ok: true,
    message: `Your booking has been cancelled.${refundNote} We've sent you a confirmation email.`,
  };
}

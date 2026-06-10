"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { hasStripeEnv, getStripe } from "@/lib/stripe/config";
import { logAppError, logAppEvent } from "@/lib/observability/server";

export type RefundActionState = { ok: boolean; message: string };

/**
 * Operator-initiated Stripe refund.
 *
 * Refunds the named payment (must be a successful Stripe-provider
 * deposit) by `amount` (partial allowed; defaults to full deposit
 * amount). Inserts a refund row in payments and triggers Stripe to
 * reverse the customer's card charge. The Stripe webhook
 * (refund.updated, refund.failed) flips the row's payment_status
 * based on the asynchronous result.
 *
 * Why this lives outside the existing record_manual_payment RPC:
 * the RPC is auth-gated on org membership; this action is the
 * single source of truth for the Stripe round-trip, so it owns
 * both the refunds.create call AND the payments insert. Splitting
 * those two writes across surfaces would invite drift between
 * Stripe-side and Korent-side state.
 *
 * Idempotency: the unique index on payments.stripe_refund_id makes
 * a webhook + double-submit safe — the second insert collides and
 * we treat it as success.
 */
export async function issueStripeRefund(
  _prev: RefundActionState,
  formData: FormData
): Promise<RefundActionState> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!orderId) return { ok: false, message: "Order is required." };
  if (!reason) return { ok: false, message: "Please describe why you're refunding." };

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Amount must be greater than 0." };
  }

  if (!hasSupabaseEnv()) return { ok: true, message: "Demo mode: refund would be issued." };
  if (!hasStripeEnv()) {
    return {
      ok: false,
      message: "Stripe is not configured. Record a manual refund instead.",
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Sign in required." };

  // Reads use the auth-gated client to inherit org RLS; writes use the
  // admin client because the refund insert needs to bypass the
  // record_manual_payment RPC's role check (the operator owns this
  // surface, but the RPC is for cash-side recordings).
  const readClient = await createSupabaseServerClient();
  const writeClient = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : readClient;

  const { data: order } = await readClient
    .from("orders")
    .select("id, order_status, total_amount")
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!order) return { ok: false, message: "Order not found." };

  // Find the captured Stripe deposit to refund against. We refund
  // against the most recent succeeded Stripe deposit; if there are
  // multiple, the operator can call this twice.
  const { data: payment } = await readClient
    .from("payments")
    .select("id, provider, provider_payment_id, amount, payment_status, payment_type")
    .eq("order_id", orderId)
    .eq("provider", "stripe")
    .eq("payment_type", "deposit")
    .eq("payment_status", "succeeded")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment || !payment.provider_payment_id) {
    return {
      ok: false,
      message:
        "No Stripe deposit found on this order. Record a manual refund instead.",
    };
  }

  if (amount > Number(payment.amount)) {
    return {
      ok: false,
      message: `Refund cannot exceed the original deposit ($${Number(payment.amount).toFixed(2)}).`,
    };
  }

  const stripe = getStripe();
  let stripeRefund;
  try {
    stripeRefund = await stripe.refunds.create({
      payment_intent: payment.provider_payment_id,
      amount: Math.round(amount * 100),
      reason: "requested_by_customer",
      metadata: {
        order_id: orderId,
        organization_id: ctx.organizationId,
        operator_note: reason.slice(0, 480),
      },
    });
  } catch (err) {
    await logAppError({
      organizationId: ctx.organizationId,
      source: "payments.refund",
      message: "Stripe refund call failed",
      context: { orderId, amount },
      error: err,
    });
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Stripe rejected the refund: ${err.message}`
          : "Stripe rejected the refund.",
    };
  }

  // Record the refund as a payment row. We use the same
  // `refund_<re_xxx>` shape for provider_payment_id that the
  // existing charge.refunded webhook handler uses, so a webhook
  // arriving after this insert hits the unique (order_id,
  // provider_payment_id) constraint and silently no-ops. The
  // stripe_refund_id column carries the raw re_xxx for direct
  // reconciliation queries.
  const initialStatus = stripeRefund.status === "succeeded" ? "paid" : "pending";
  const providerRef = `refund_${stripeRefund.id}`;

  const { error: insertError } = await writeClient
    .from("payments")
    .insert({
      order_id: orderId,
      provider: "stripe",
      provider_payment_id: providerRef,
      payment_type: "refund",
      payment_status: initialStatus,
      amount: amount,
      paid_at:
        stripeRefund.status === "succeeded"
          ? new Date().toISOString()
          : null,
      payment_method: "card",
      reference_note: reason,
      refund_reason: reason,
      stripe_refund_id: stripeRefund.id,
    });

  // Unique-index collision is the webhook-already-landed case — fine.
  if (insertError && !/duplicate key/i.test(insertError.message)) {
    await logAppError({
      organizationId: ctx.organizationId,
      source: "payments.refund.insert",
      message: "Refund insert failed after Stripe success",
      context: {
        orderId,
        stripeRefundId: stripeRefund.id,
        reason: insertError.message,
      },
    });
    return {
      ok: false,
      message:
        "Refund was issued via Stripe but we couldn't record it locally. Check the Stripe dashboard and contact support.",
    };
  }

  await logAppEvent({
    organizationId: ctx.organizationId,
    source: "payments.refund",
    action: "stripe_refund_issued",
    status: "info",
    metadata: {
      orderId,
      amount,
      stripeRefundId: stripeRefund.id,
      stripeStatus: stripeRefund.status,
    },
  });

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");

  return {
    ok: true,
    message:
      stripeRefund.status === "succeeded"
        ? `Refunded $${amount.toFixed(2)} to the customer's card.`
        : `Refund of $${amount.toFixed(2)} is pending. We'll update the status when Stripe confirms.`,
  };
}

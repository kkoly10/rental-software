import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe/config";
import { logAppError, logAppEvent } from "@/lib/observability/server";

export type RefundExecution =
  | { ok: true; stripeRefundId: string; status: "paid" | "pending" }
  | { ok: false; code: "no_deposit" | "exceeds_deposit" | "stripe_rejected" | "record_failed"; message: string };

/**
 * Shared Stripe-refund engine — used by the operator's "Refund
 * deposit" action AND the portal cancellation auto-refund, so the
 * Connect routing, ledger insert, and webhook-race handling exist
 * exactly once.
 *
 * Steps:
 *  1. find the most recent PAID Stripe deposit on the order
 *     (payment_status convention in this codebase is 'paid' — the
 *     webhook and record_manual_payment both write 'paid')
 *  2. refund on the operator's connected account (direct charge),
 *     falling back to the platform account on resource_missing for
 *     pre-Connect deposits
 *  3. insert the refund row keyed `refund_<re_xxx>` so the
 *     charge.refunded webhook's insert collides instead of duping
 *
 * `client` must be able to read payments/organizations and write
 * payments for the org (admin client, or an operator session).
 * Callers own authorization — this function does not gate.
 */
export async function executeStripeRefundForOrder(
  client: SupabaseClient,
  params: {
    organizationId: string;
    orderId: string;
    /** Dollars. Must be > 0 and ≤ the captured deposit. */
    amount: number;
    /** Ledger note — operator's reason or "customer self-cancel". */
    reason: string;
    /** Audit label: which surface initiated it. */
    source: "operator" | "portal_cancel";
  }
): Promise<RefundExecution> {
  const { organizationId, orderId, amount, reason, source } = params;

  const { data: payment } = await client
    .from("payments")
    .select("id, provider_payment_id, amount")
    .eq("order_id", orderId)
    .eq("provider", "stripe")
    .eq("payment_type", "deposit")
    .eq("payment_status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment?.provider_payment_id) {
    return {
      ok: false,
      code: "no_deposit",
      message: "No Stripe deposit found on this order.",
    };
  }
  if (amount > Number(payment.amount)) {
    return {
      ok: false,
      code: "exceeds_deposit",
      message: `Refund cannot exceed the original deposit ($${Number(payment.amount).toFixed(2)}).`,
    };
  }

  const { data: connectRow } = await client
    .from("organizations")
    .select("stripe_connect_account_id")
    .eq("id", organizationId)
    .maybeSingle();
  const connectAccountId = connectRow?.stripe_connect_account_id ?? null;

  const stripe = getStripe();
  const refundParams = {
    payment_intent: payment.provider_payment_id,
    amount: Math.round(amount * 100),
    reason: "requested_by_customer" as const,
    metadata: {
      order_id: orderId,
      organization_id: organizationId,
      operator_note: reason.slice(0, 480),
      initiated_by: source,
    },
  };

  let stripeRefund;
  try {
    if (connectAccountId) {
      try {
        stripeRefund = await stripe.refunds.create(refundParams, {
          stripeAccount: connectAccountId,
        });
      } catch (connectErr) {
        const code = (connectErr as { code?: string })?.code;
        if (code !== "resource_missing") throw connectErr;
        // Deposit predates Connect — it lives on the platform account.
        stripeRefund = await stripe.refunds.create(refundParams);
      }
    } else {
      stripeRefund = await stripe.refunds.create(refundParams);
    }
  } catch (err) {
    await logAppError({
      organizationId,
      source: `payments.refund.${source}`,
      message: "Stripe refund call failed",
      context: { orderId, amount },
      error: err,
    });
    return {
      ok: false,
      code: "stripe_rejected",
      message:
        err instanceof Error
          ? `Stripe rejected the refund: ${err.message}`
          : "Stripe rejected the refund.",
    };
  }

  const status = stripeRefund.status === "succeeded" ? "paid" : "pending";
  const { error: insertError } = await client.from("payments").insert({
    order_id: orderId,
    provider: "stripe",
    provider_payment_id: `refund_${stripeRefund.id}`,
    payment_type: "refund",
    payment_status: status,
    amount,
    paid_at: status === "paid" ? new Date().toISOString() : null,
    payment_method: "card",
    reference_note: reason,
    refund_reason: reason,
    stripe_refund_id: stripeRefund.id,
  });

  // Unique-index collision = the charge.refunded webhook landed first.
  if (insertError && !/duplicate key/i.test(insertError.message)) {
    await logAppError({
      organizationId,
      source: `payments.refund.${source}.insert`,
      message: "Refund insert failed after Stripe success",
      context: { orderId, stripeRefundId: stripeRefund.id, reason: insertError.message },
    });
    return {
      ok: false,
      code: "record_failed",
      message:
        "Refund was issued via Stripe but we couldn't record it locally. Check the Stripe dashboard and contact support.",
    };
  }

  await logAppEvent({
    organizationId,
    source: `payments.refund.${source}`,
    action: "stripe_refund_issued",
    status: "info",
    metadata: { orderId, amount, stripeRefundId: stripeRefund.id, stripeStatus: stripeRefund.status },
  });

  return { ok: true, stripeRefundId: stripeRefund.id, status };
}

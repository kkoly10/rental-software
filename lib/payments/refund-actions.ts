"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { hasStripeEnv } from "@/lib/stripe/config";

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

  // Reads use the auth-gated client to inherit org RLS; the refund
  // engine writes through the admin client because the refund insert
  // bypasses the record_manual_payment RPC (that RPC is for cash-side
  // recordings; Stripe-side rows are owned by the refund core).
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

  // PR-2b — Stripe routing (connected-account-first with platform
  // fallback), deposit lookup, and the ledger insert live in the
  // shared refund core so the portal cancellation auto-refund and
  // this operator surface can never drift apart.
  const { executeStripeRefundForOrder } = await import("@/lib/payments/refund-core");
  const result = await executeStripeRefundForOrder(writeClient, {
    organizationId: ctx.organizationId,
    orderId,
    amount,
    reason,
    source: "operator",
  });

  if (!result.ok) {
    const friendly =
      result.code === "no_deposit"
        ? "No Stripe deposit found on this order. Record a manual refund instead."
        : result.message;
    return { ok: false, message: friendly };
  }

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");

  return {
    ok: true,
    message:
      result.status === "paid"
        ? `Refunded $${amount.toFixed(2)} to the customer's card.`
        : `Refund of $${amount.toFixed(2)} is pending. We'll update the status when Stripe confirms.`,
  };
}

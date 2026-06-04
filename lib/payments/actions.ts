"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { recordPaymentSchema } from "@/lib/validation/payments";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export type PaymentActionState = {
  ok: boolean;
  message: string;
};

function toPaidAtIso(value?: string) {
  if (!value) {
    return new Date().toISOString();
  }

  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

export async function recordPayment(
  _prevState: PaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  const parsed = recordPaymentSchema.safeParse({
    orderId: String(formData.get("order_id") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    paymentType: String(formData.get("payment_type") ?? "deposit"),
    paymentMethod: String(formData.get("payment_method") ?? "cash"),
    referenceNote: String(formData.get("reference_note") ?? ""),
    paidAt: String(formData.get("paid_at") ?? ""),
    source: String(formData.get("source") ?? "dashboard"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the payment details.",
    };
  }

  const { orderId, amount, paymentType, paymentMethod, referenceNote, paidAt, source } =
    parsed.data;

  if (!hasSupabaseEnv()) {
    // Re-audit follow-up #3b: be explicit that the order's auto-confirm
    // didn't fire either. Without this the dev gets the success toast,
    // expects the order to flip to "confirmed", then stays confused
    // because nothing happens.
    return {
      ok: true,
      message: `Demo mode: $${amount.toFixed(2)} ${paymentType} payment would be recorded. The order status will not auto-update — connect Supabase to enable persistence and auto-confirm.`,
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in to record payments." };
  }

  const { blockDemoWrites } = await import("@/lib/demo/guard");
  const demoCheck = await blockDemoWrites(ctx.organizationId);
  if (demoCheck.blocked) return { ok: false, message: demoCheck.message };

  try {
    const clientKey = await getActionClientKey();
    const [userLimit, clientLimit] = await Promise.all([
      enforceRateLimit({
        scope: "payments:record:user",
        actor: ctx.userId,
        limit: 40,
        windowSeconds: 300,
      }),
      enforceRateLimit({
        scope: "payments:record:client",
        actor: clientKey,
        limit: 60,
        windowSeconds: 300,
      }),
    ]);

    if (!userLimit.allowed || !clientLimit.allowed) {
      return {
        ok: false,
        message: "Too many payment actions. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to record payments right now. Please try again shortly.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: paymentMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(paymentMembership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to record payments." };
  }

  // Fetch order_status (needed for auto-confirm logic below)
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_status, deposit_due_amount")
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) {
    return { ok: false, message: "Order not found." };
  }

  // Reject payment recordings against terminal-state orders. A
  // Decision 2.14 — refunds are a separate transaction posted against the
  // payment, not a re-open of the order (ASC 606 + QuickBooks standard).
  // A cancelled order should still accept refund payments because the
  // customer's already-captured deposit needs to come back out. Forbid only
  // positive payments on cancelled/refunded/completed orders.
  if (order.order_status === "refunded") {
    return {
      ok: false,
      message: "Cannot record payments on a refunded order.",
    };
  }
  if (order.order_status === "cancelled" && paymentType !== "refund") {
    return {
      ok: false,
      message:
        "Cannot record additional payments on a cancelled order. Only refunds are allowed.",
    };
  }
  if (order.order_status === "completed" && paymentType !== "refund") {
    return {
      ok: false,
      message: "Cannot record additional payments on a completed order. Only refunds are allowed.",
    };
  }

  // Atomically validate + insert + update cached balance via DB function.
  // The function uses SELECT FOR UPDATE on the order row to prevent concurrent
  // payments from both passing the balance check before either is committed.
  const { data: rpcResult, error: rpcError } = await supabase.rpc("record_manual_payment", {
    p_order_id:       orderId,
    p_org_id:         ctx.organizationId,
    p_amount:         amount,
    p_payment_type:   paymentType,
    p_payment_method: paymentMethod,
    p_reference_note: referenceNote ?? null,
    p_paid_at:        toPaidAtIso(paidAt),
  });

  if (rpcError) {
    console.error("[payments] record_manual_payment RPC failed:", rpcError.message);
    return { ok: false, message: "Couldn't record the payment. Please try again." };
  }

  const result = rpcResult as { ok: boolean; message?: string; new_balance?: number; net_paid?: number } | null;
  if (!result?.ok) {
    return { ok: false, message: result?.message ?? "Failed to record payment." };
  }

  const newBalance = result.new_balance ?? 0;
  const netPaid = result.net_paid ?? 0;
  // Use net_paid from the RPC (the post-write computed value) against
  // the deposit_due_amount we read pre-RPC. deposit_due_amount on the
  // order row doesn't change during this transaction, so the pre-RPC
  // value is still correct. The previous expression compared a fresh
  // post-RPC net_paid against a stale pre-RPC deposit — which happened
  // to work because deposit_due_amount is set at order creation and
  // never re-derived. Restated explicitly to make the invariant clear.
  const depositRequired = Number(order.deposit_due_amount ?? 0);
  const updatedFinancials = {
    remainingBalance: newBalance,
    depositFulfilled: netPaid >= depositRequired,
  };

  // Audit log: manual payment / refund recording is one of the most
  // financially sensitive operations and was previously silent in
  // app_event_logs. An admin / dispatcher can credit or refund money;
  // we want a trail with the actor, amount, method, and reference note
  // (sanitized) for compliance + incident response.
  {
    const { logAppEvent } = await import("@/lib/observability/server");
    await logAppEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      source: "payments.record_manual",
      action: paymentType === "refund" ? "manual_refund" : "manual_payment",
      status: "success",
      route: "lib/payments/actions",
      metadata: {
        order_id: orderId,
        amount,
        payment_type: paymentType,
        payment_method: paymentMethod,
        net_paid: netPaid,
        new_balance: newBalance,
        // Attribution channel for compliance: "copilot" means the operator
        // recorded this through the AI Operator Copilot (still on their own
        // authenticated account, with an explicit confirm-before-apply step).
        recorded_via: source,
      },
    });
  }

  // Auto-confirm orders when deposit is fulfilled.
  // #342 TOCTOU — gate the UPDATE on the still-current order_status so a
  // concurrent operator cancellation between the SELECT above and this
  // UPDATE isn't silently overwritten by "confirmed".
  if (
    paymentType !== "refund" &&
    updatedFinancials?.depositFulfilled &&
    order.order_status === "awaiting_deposit"
  ) {
    await supabase
      .from("orders")
      .update({ order_status: "confirmed" })
      .eq("id", orderId)
      .eq("organization_id", ctx.organizationId)
      .eq("order_status", "awaiting_deposit")
      .is("deleted_at", null);
  }

  // Mirror the Stripe webhook's auto-flip to "refunded" for the manual
  // refund path. The webhook handler at app/api/stripe/webhooks/route.ts
  // does the same when refundFinancials.totalPaid <= 0; previously the
  // manual path only auto-confirmed (the block above) and left the order
  // dangling in its prior status after the refund cleared the balance.
  // Don't overwrite terminal statuses (`cancelled` / `refunded`) — the
  // .not() guard handles the TOCTOU window between SELECT and UPDATE.
  //
  // Use a half-cent epsilon instead of `<= 0`: a $99.99 refund on a $100
  // order leaves netPaid at $0.01 due to float math, and the strict zero
  // check left those orders stuck in their prior status.
  if (paymentType === "refund" && netPaid <= 0.005) {
    await supabase
      .from("orders")
      .update({ order_status: "refunded" })
      .eq("id", orderId)
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .not("order_status", "in", '("cancelled","refunded")');
  }

  // Convert any temporary checkout_hold to permanent now that payment is recorded.
  // Without this, the cleanup cron could expire the hold before the Stripe webhook fires,
  // or for non-Stripe orders where no webhook exists at all.
  if (paymentType !== "refund") {
    await supabase
      .from("availability_blocks")
      .update({ expires_at: null, block_type: "order_hold" })
      .eq("source_order_id", orderId)
      .eq("organization_id", ctx.organizationId)
      .eq("block_type", "checkout_hold");
  }

  revalidatePath("/dashboard/payments");
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/customers/[id]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/order-status");

  try {
    const [{ triggerPaymentReceivedEmail }, orderResult, orgResult] = await Promise.all([
      import("@/lib/email/triggers"),
      supabase.from("orders").select("order_number, customer_id").eq("id", orderId).eq("organization_id", ctx.organizationId).is("deleted_at", null).maybeSingle(),
      supabase.from("organizations").select("name").eq("id", ctx.organizationId).is("deleted_at", null).maybeSingle(),
    ]);
    const fullOrder = orderResult.data;

    if (fullOrder?.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("first_name, email, phone, sms_opt_in")
        .eq("id", fullOrder.customer_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (customer?.email) {
        const emailTask = triggerPaymentReceivedEmail({
          organizationId: ctx.organizationId,
          customerFirstName: customer.first_name ?? "there",
          customerEmail: customer.email,
          orderNumber: fullOrder.order_number,
          amount,
          paymentType,
          paymentMethod,
          newBalance,
        });

        const smsTask = customer.phone && customer.sms_opt_in && paymentType !== "refund"
          ? import("@/lib/sms/send-notification").then(({ sendSmsNotification }) =>
              sendSmsNotification("paymentReceived", customer.phone!, {
                amount: amount.toFixed(2),
                orderNumber: fullOrder.order_number,
                businessName: orgResult.data?.name ?? "Your rental company",
              }, ctx.organizationId, { orderId: orderId as string, customerId: fullOrder.customer_id })
            )
          : Promise.resolve();

        await Promise.allSettled([emailTask, smsTask]);
      }
    }
  } catch (err) {
    console.error("[payments] Failed to send payment confirmation email for order", orderId);
    const { logAppError } = await import("@/lib/observability/server");
    await logAppError({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      source: "payments",
      message: "manual payment notification (email + SMS) failed (payment already recorded)",
      route: "lib/payments/actions",
      context: { order_id: orderId, payment_type: paymentType },
      error: err,
    });
  }

  return {
    ok: true,
    message:
      paymentType === "refund"
        ? `Refund of $${amount.toFixed(2)} recorded successfully.`
        : `$${amount.toFixed(2)} ${paymentType} recorded successfully.`,
  };
}

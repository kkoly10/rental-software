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
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the payment details.",
    };
  }

  const { orderId, amount, paymentType, paymentMethod, referenceNote, paidAt } =
    parsed.data;

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: $${amount.toFixed(2)} ${paymentType} payment would be recorded.`,
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in to record payments." };
  }

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
    .maybeSingle();

  if (!order) {
    return { ok: false, message: "Order not found." };
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
    return { ok: false, message: rpcError.message };
  }

  const result = rpcResult as { ok: boolean; message?: string; new_balance?: number; net_paid?: number } | null;
  if (!result?.ok) {
    return { ok: false, message: result?.message ?? "Failed to record payment." };
  }

  const newBalance = result.new_balance ?? 0;
  const netPaid = result.net_paid ?? 0;
  const updatedFinancials = { remainingBalance: newBalance, depositFulfilled: netPaid >= Number(order.deposit_due_amount ?? 0) };

  // Auto-confirm orders when deposit is fulfilled
  if (
    paymentType !== "refund" &&
    updatedFinancials?.depositFulfilled &&
    order.order_status === "awaiting_deposit"
  ) {
    await supabase
      .from("orders")
      .update({ order_status: "confirmed" })
      .eq("id", orderId)
      .eq("organization_id", ctx.organizationId);
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
  } catch {
    console.error("[payments] Failed to send payment confirmation email for order", orderId);
  }

  return {
    ok: true,
    message:
      paymentType === "refund"
        ? `Refund of $${amount.toFixed(2)} recorded successfully.`
        : `$${amount.toFixed(2)} ${paymentType} recorded successfully.`,
  };
}

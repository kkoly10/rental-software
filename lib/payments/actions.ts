"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { recordPaymentSchema } from "@/lib/validation/payments";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getOrderFinancials } from "@/lib/payments/financials";

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

  // Fetch the order to verify it exists and belongs to this org
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_status, total_amount, deposit_due_amount")
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!order) {
    return { ok: false, message: "Order not found." };
  }

  // Compute the current financial state from the payments table (never trust stored balance)
  const financials = await getOrderFinancials(orderId);
  const currentBalance = financials?.remainingBalance ?? Number(order.total_amount ?? 0);

  if (paymentType !== "refund" && amount > currentBalance) {
    return {
      ok: false,
      message: "Payment amount cannot be greater than the outstanding balance.",
    };
  }

  // Insert the payment record — this is the source of truth
  const { error } = await supabase.from("payments").insert({
    order_id: orderId,
    payment_type: paymentType,
    payment_status: "paid",
    amount,
    payment_method: paymentMethod,
    reference_note: referenceNote ?? null,
    paid_at: toPaidAtIso(paidAt),
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  // Re-compute balance AFTER the new payment is inserted
  // balance_due_amount is kept in sync as a cache for queries/reports,
  // but the computed value from payments is always authoritative.
  const updatedFinancials = await getOrderFinancials(orderId);
  const newBalance = updatedFinancials?.remainingBalance ?? 0;

  await supabase
    .from("orders")
    .update({ balance_due_amount: newBalance })
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId);

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

  revalidatePath("/dashboard/payments");
  revalidatePath(`/dashboard/orders/${orderId}`);

  // Send payment email to customer (non-blocking)
  import("@/lib/email/triggers").then(async ({ triggerPaymentReceivedEmail }) => {
    // Fetch customer details for the email
    const { data: fullOrder } = await supabase
      .from("orders")
      .select("order_number, customer_id")
      .eq("id", orderId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();

    if (!fullOrder?.customer_id) return;

    const { data: customer } = await supabase
      .from("customers")
      .select("first_name, email, phone")
      .eq("id", fullOrder.customer_id)
      .maybeSingle();

    if (!customer?.email) return;

    await triggerPaymentReceivedEmail({
      organizationId: ctx.organizationId,
      customerFirstName: customer.first_name ?? "there",
      customerEmail: customer.email,
      orderNumber: fullOrder.order_number,
      amount,
      paymentType,
      paymentMethod,
      newBalance,
    });

    // Send payment SMS (non-blocking, skip for refunds)
    if (customer.phone && paymentType !== "refund") {
      const { sendSmsNotification } = await import("@/lib/sms/send-notification");
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", ctx.organizationId)
        .maybeSingle();
      await sendSmsNotification("paymentReceived", customer.phone, {
        amount: amount.toFixed(2),
        orderNumber: fullOrder.order_number,
        businessName: org?.name ?? "Your rental company",
      });
    }
  }).catch(() => {});

  return {
    ok: true,
    message:
      paymentType === "refund"
        ? `Refund of $${amount.toFixed(2)} recorded successfully.`
        : `$${amount.toFixed(2)} ${paymentType} recorded successfully.`,
  };
}

"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";

export type PaymentActionState = {
  ok: boolean;
  message: string;
};

export async function recordPayment(
  _prevState: PaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const amount = parseFloat(String(formData.get("amount") ?? "0"));
  const paymentType = String(formData.get("payment_type") ?? "deposit").trim();
  const paymentMethod = String(formData.get("payment_method") ?? "cash").trim();
  const referenceNote = String(formData.get("reference_note") ?? "").trim();
  const paidAt = String(formData.get("paid_at") ?? "").trim();

  if (!orderId) {
    return { ok: false, message: "Order ID is required." };
  }
  if (amount <= 0) {
    return { ok: false, message: "Payment amount must be greater than zero." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo mode: $${amount} ${paymentType} payment would be recorded.` };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in to record payments." };
  }

  const supabase = await createSupabaseServerClient();

  // Verify order belongs to user's org
  const { data: order } = await supabase
    .from("orders")
    .select("id, balance_due_amount")
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!order) {
    return { ok: false, message: "Order not found." };
  }

  // Insert payment record
  const { error } = await supabase.from("payments").insert({
    order_id: orderId,
    payment_type: paymentType,
    payment_status: "paid",
    amount,
    payment_method: paymentMethod,
    reference_note: referenceNote || null,
    paid_at: paidAt || new Date().toISOString(),
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  // Update order balance
  const newBalance = Math.max(0, (order.balance_due_amount ?? 0) - amount);
  await supabase
    .from("orders")
    .update({ balance_due_amount: newBalance })
    .eq("id", orderId);

  // If balance is now 0 and order is awaiting_deposit, auto-confirm
  if (newBalance === 0) {
    const { data: currentOrder } = await supabase
      .from("orders")
      .select("order_status")
      .eq("id", orderId)
      .maybeSingle();

    if (currentOrder?.order_status === "awaiting_deposit") {
      await supabase
        .from("orders")
        .update({ order_status: "confirmed" })
        .eq("id", orderId);
    }
  }

  revalidatePath("/dashboard/payments");
  revalidatePath(`/dashboard/orders/${orderId}`);

  return { ok: true, message: `$${amount} ${paymentType} recorded successfully.` };
}

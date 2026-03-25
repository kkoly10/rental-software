"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type OrderActionState = {
  ok: boolean;
  message: string;
};

function createOrderNumber() {
  return `ORD-${Date.now()}`;
}

export async function createOrder(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "").trim();
  const orderStatus = String(formData.get("order_status") ?? "inquiry").trim();
  const subtotal = parseFloat(String(formData.get("subtotal") ?? "0"));
  const deliveryFee = parseFloat(String(formData.get("delivery_fee") ?? "0"));
  const depositAmount = parseFloat(String(formData.get("deposit_amount") ?? "0"));
  const notes = String(formData.get("notes") ?? "").trim();

  if (!firstName || !lastName) {
    return { ok: false, message: "Customer first and last name are required." };
  }

  if (!hasSupabaseEnv()) {
    const orderNumber = createOrderNumber();
    return { ok: true, message: `Demo mode: Order ${orderNumber} would be created.` };
  }

  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!org) {
    return { ok: false, message: "No organization found. Complete onboarding first." };
  }

  // Upsert customer by email or create new
  let customerId: string;
  if (email) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", org.id)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;
    } else {
      const { data: newCust, error: custErr } = await supabase
        .from("customers")
        .insert({ organization_id: org.id, first_name: firstName, last_name: lastName, email, phone })
        .select("id")
        .single();
      if (custErr || !newCust) return { ok: false, message: custErr?.message ?? "Failed to create customer." };
      customerId = newCust.id;
    }
  } else {
    const { data: newCust, error: custErr } = await supabase
      .from("customers")
      .insert({ organization_id: org.id, first_name: firstName, last_name: lastName, phone })
      .select("id")
      .single();
    if (custErr || !newCust) return { ok: false, message: custErr?.message ?? "Failed to create customer." };
    customerId = newCust.id;
  }

  const total = subtotal + deliveryFee;
  const balance = total - depositAmount;
  const orderNumber = createOrderNumber();

  const { error: orderError } = await supabase.from("orders").insert({
    organization_id: org.id,
    customer_id: customerId,
    order_number: orderNumber,
    order_status: orderStatus,
    event_date: eventDate || null,
    subtotal_amount: subtotal,
    delivery_fee_amount: deliveryFee,
    total_amount: total,
    deposit_due_amount: depositAmount,
    balance_due_amount: balance,
    notes: notes || null,
    source_channel: "dashboard",
  });

  if (orderError) {
    return { ok: false, message: orderError.message };
  }

  redirect("/dashboard/orders");
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: string
): Promise<OrderActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Status would be updated." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ order_status: newStatus })
    .eq("id", orderId);

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, message: `Order status updated to ${newStatus}.` };
}

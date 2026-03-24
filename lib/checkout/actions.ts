"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CheckoutActionState = {
  ok: boolean;
  message: string;
};

function createOrderNumber() {
  return `ORD-${Date.now()}`;
}

export async function createCheckoutOrder(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const line1 = String(formData.get("line1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postalCode = String(formData.get("postal_code") ?? "").trim();

  if (!firstName || !lastName || !email || !line1 || !city || !state || !postalCode) {
    return {
      ok: false,
      message: "Please complete all required checkout fields.",
    };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: "Checkout form is wired. Add Supabase env vars to create live orders.",
    };
  }

  const supabase = createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!org) {
    return {
      ok: false,
      message: "No organization found. Complete onboarding first.",
    };
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      organization_id: org.id,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
    })
    .select("id")
    .single();

  if (customerError || !customer) {
    return {
      ok: false,
      message: customerError?.message ?? "Unable to create customer.",
    };
  }

  const { data: address, error: addressError } = await supabase
    .from("customer_addresses")
    .insert({
      customer_id: customer.id,
      label: "Delivery",
      line1,
      city,
      state,
      postal_code: postalCode,
      is_default_delivery: true,
    })
    .select("id")
    .single();

  if (addressError || !address) {
    return {
      ok: false,
      message: addressError?.message ?? "Unable to create address.",
    };
  }

  const orderNumber = createOrderNumber();

  const { error: orderError } = await supabase.from("orders").insert({
    organization_id: org.id,
    customer_id: customer.id,
    order_number: orderNumber,
    order_status: "awaiting_deposit",
    delivery_address_id: address.id,
    subtotal_amount: 225,
    delivery_fee_amount: 20,
    total_amount: 245,
    deposit_due_amount: 75,
    balance_due_amount: 170,
  });

  if (orderError) {
    return {
      ok: false,
      message: orderError.message,
    };
  }

  return {
    ok: true,
    message: `Order ${orderNumber} created successfully.`,
  };
}

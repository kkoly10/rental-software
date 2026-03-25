"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";

export type CheckoutActionState = {
  ok: boolean;
  message: string;
  orderNumber?: string;
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
  const eventDate = String(formData.get("event_date") ?? "").trim();
  const productSlug = String(formData.get("product_slug") ?? "").trim();

  if (!firstName || !lastName || !email || !line1 || !city || !state || !postalCode) {
    return { ok: false, message: "Please complete all required checkout fields." };
  }

  if (!hasSupabaseEnv()) {
    const orderNumber = createOrderNumber();
    return {
      ok: true,
      message: `Demo mode: Order ${orderNumber} would be created. Add Supabase env vars to create live orders.`,
      orderNumber,
    };
  }

  // Public checkout uses public org context (single-tenant MVP)
  const orgId = await getPublicOrgId();
  if (!orgId) {
    return { ok: false, message: "No organization found. An operator must complete onboarding first." };
  }

  const supabase = await createSupabaseServerClient();

  // Create customer
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      organization_id: orgId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
    })
    .select("id")
    .single();

  if (customerError || !customer) {
    return { ok: false, message: customerError?.message ?? "Unable to create customer." };
  }

  // Create address
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
    return { ok: false, message: addressError?.message ?? "Unable to create address." };
  }

  // Look up product for pricing
  let subtotal = 225;
  let productId: string | null = null;
  let productName = "Rental booking";
  if (productSlug) {
    const { data: product } = await supabase
      .from("products")
      .select("id, name, base_price")
      .eq("slug", productSlug)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (product) {
      subtotal = typeof product.base_price === "number" ? product.base_price : 225;
      productId = product.id;
      productName = product.name ?? productSlug;
    }
  }

  const deliveryFee = 20;
  const total = subtotal + deliveryFee;
  const deposit = Math.round(total * 0.3);
  const balance = total - deposit;

  const orderNumber = createOrderNumber();

  // Create order and get the real inserted UUID back
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      organization_id: orgId,
      customer_id: customer.id,
      order_number: orderNumber,
      order_status: "awaiting_deposit",
      event_date: eventDate || null,
      delivery_address_id: address.id,
      subtotal_amount: subtotal,
      delivery_fee_amount: deliveryFee,
      total_amount: total,
      deposit_due_amount: deposit,
      balance_due_amount: balance,
      source_channel: "website",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { ok: false, message: orderError?.message ?? "Unable to create order." };
  }

  // Create order item using the REAL order UUID
  if (productId) {
    await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: productId,
      line_type: "rental",
      quantity: 1,
      unit_price: subtotal,
      line_total: subtotal,
      item_name_snapshot: productName,
    });
  }

  return {
    ok: true,
    message: `Order ${orderNumber} created successfully! A deposit of $${deposit} is required to confirm your booking.`,
    orderNumber,
  };
}

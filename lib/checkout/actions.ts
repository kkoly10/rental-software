"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { checkoutOrderSchema } from "@/lib/validation/checkout";
import { createOrderNumber } from "@/lib/orders/order-number";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export type CheckoutActionState = {
  ok: boolean;
  message: string;
  orderNumber?: string;
};

export async function createCheckoutOrder(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const parsed = checkoutOrderSchema.safeParse({
    firstName: String(formData.get("first_name") ?? ""),
    lastName: String(formData.get("last_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    line1: String(formData.get("line1") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    postalCode: String(formData.get("postal_code") ?? ""),
    eventDate: String(formData.get("event_date") ?? ""),
    productSlug: String(formData.get("product_slug") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review your checkout details.",
    };
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    line1,
    city,
    state,
    postalCode,
    eventDate,
    productSlug,
  } = parsed.data;

  try {
    const clientKey = await getActionClientKey();
    const [clientLimit, emailLimit] = await Promise.all([
      enforceRateLimit({
        scope: "checkout:client",
        actor: clientKey,
        limit: 8,
        windowSeconds: 3600,
      }),
      enforceRateLimit({
        scope: "checkout:email",
        actor: email,
        limit: 5,
        windowSeconds: 3600,
      }),
    ]);

    if (!clientLimit.allowed || !emailLimit.allowed) {
      return {
        ok: false,
        message: "Too many checkout attempts. Please wait a bit and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to process checkout right now. Please try again shortly.",
    };
  }

  if (!hasSupabaseEnv()) {
    const orderNumber = createOrderNumber();
    return {
      ok: true,
      message: `Demo mode: Order ${orderNumber} would be created. Add Supabase env vars to create live orders.`,
      orderNumber,
    };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    return {
      ok: false,
      message: "No organization found. An operator must complete onboarding first.",
    };
  }

  const supabase = await createSupabaseServerClient();

  let customerId: string;
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", orgId)
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (existingCustomer) {
    customerId = existingCustomer.id;

    const { error: updateCustomerError } = await supabase
      .from("customers")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone ?? null,
      })
      .eq("id", customerId)
      .eq("organization_id", orgId);

    if (updateCustomerError) {
      return {
        ok: false,
        message: updateCustomerError.message,
      };
    }
  } else {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        organization_id: orgId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone ?? null,
      })
      .select("id")
      .single();

    if (customerError || !customer) {
      return {
        ok: false,
        message: customerError?.message ?? "Unable to create customer.",
      };
    }

    customerId = customer.id;
  }

  const { data: address, error: addressError } = await supabase
    .from("customer_addresses")
    .insert({
      customer_id: customerId,
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
      subtotal =
        typeof product.base_price === "number"
          ? Number(product.base_price)
          : 225;
      productId = product.id;
      productName = product.name ?? productSlug;
    }
  }

  const deliveryFee = 20;
  const total = Number((subtotal + deliveryFee).toFixed(2));
  const deposit = Number((total * 0.3).toFixed(2));
  const balance = Number((total - deposit).toFixed(2));
  const orderNumber = createOrderNumber();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      organization_id: orgId,
      customer_id: customerId,
      order_number: orderNumber,
      order_status: "awaiting_deposit",
      event_date: eventDate ?? null,
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
    return {
      ok: false,
      message: orderError?.message ?? "Unable to create order.",
    };
  }

  if (productId) {
    const { error: itemError } = await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: productId,
      line_type: "rental",
      quantity: 1,
      unit_price: subtotal,
      line_total: subtotal,
      item_name_snapshot: productName,
    });

    if (itemError) {
      return {
        ok: false,
        message: itemError.message,
      };
    }
  }

  return {
    ok: true,
    message: `Order ${orderNumber} created successfully! A deposit of $${deposit.toFixed(
      2
    )} is required to confirm your booking.`,
    orderNumber,
  };
}
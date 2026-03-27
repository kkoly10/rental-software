"use server";

import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import {
  createOrderSchema,
  updateOrderStatusSchema,
} from "@/lib/validation/orders";
import { createOrderNumber } from "@/lib/orders/order-number";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export type OrderActionState = {
  ok: boolean;
  message: string;
};

export async function createOrder(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const parsed = createOrderSchema.safeParse({
    firstName: String(formData.get("first_name") ?? ""),
    lastName: String(formData.get("last_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    eventDate: String(formData.get("event_date") ?? ""),
    orderStatus: String(formData.get("order_status") ?? "inquiry"),
    subtotal: String(formData.get("subtotal") ?? "0"),
    deliveryFee: String(formData.get("delivery_fee") ?? "0"),
    depositAmount: String(formData.get("deposit_amount") ?? "0"),
    notes: String(formData.get("notes") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the order details.",
    };
  }

  if (!hasSupabaseEnv()) {
    const orderNumber = createOrderNumber();
    return {
      ok: true,
      message: `Demo mode: Order ${orderNumber} would be created.`,
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return {
      ok: false,
      message: "You must be signed in with an organization to create orders.",
    };
  }

  try {
    const clientKey = await getActionClientKey();
    const [userLimit, clientLimit] = await Promise.all([
      enforceRateLimit({
        scope: "orders:create:user",
        actor: ctx.userId,
        limit: 25,
        windowSeconds: 300,
      }),
      enforceRateLimit({
        scope: "orders:create:client",
        actor: clientKey,
        limit: 40,
        windowSeconds: 300,
      }),
    ]);

    if (!userLimit.allowed || !clientLimit.allowed) {
      return {
        ok: false,
        message: "Too many order creation attempts. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to create orders right now. Please try again shortly.",
    };
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    eventDate,
    orderStatus,
    subtotal,
    deliveryFee,
    depositAmount,
    notes,
  } = parsed.data;

  const supabase = await createSupabaseServerClient();

  let customerId: string;

  if (email) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;

      const { error: updateCustomerError } = await supabase
        .from("customers")
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: phone ?? null,
        })
        .eq("id", customerId)
        .eq("organization_id", ctx.organizationId);

      if (updateCustomerError) {
        return { ok: false, message: updateCustomerError.message };
      }
    } else {
      const { data: newCust, error: custErr } = await supabase
        .from("customers")
        .insert({
          organization_id: ctx.organizationId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone ?? null,
        })
        .select("id")
        .single();

      if (custErr || !newCust) {
        return {
          ok: false,
          message: custErr?.message ?? "Failed to create customer.",
        };
      }

      customerId = newCust.id;
    }
  } else {
    const { data: newCust, error: custErr } = await supabase
      .from("customers")
      .insert({
        organization_id: ctx.organizationId,
        first_name: firstName,
        last_name: lastName,
        phone: phone ?? null,
      })
      .select("id")
      .single();

    if (custErr || !newCust) {
      return {
        ok: false,
        message: custErr?.message ?? "Failed to create customer.",
      };
    }

    customerId = newCust.id;
  }

  const total = Number((subtotal + deliveryFee).toFixed(2));
  const balance = Number((total - depositAmount).toFixed(2));
  const orderNumber = createOrderNumber();

  const { error: orderError } = await supabase.from("orders").insert({
    organization_id: ctx.organizationId,
    customer_id: customerId,
    order_number: orderNumber,
    order_status: orderStatus,
    event_date: eventDate ?? null,
    subtotal_amount: subtotal,
    delivery_fee_amount: deliveryFee,
    total_amount: total,
    deposit_due_amount: depositAmount,
    balance_due_amount: balance,
    notes: notes ?? null,
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

  const parsed = updateOrderStatusSchema.safeParse({
    orderId,
    newStatus,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid order update request.",
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  try {
    const userLimit = await enforceRateLimit({
      scope: "orders:update-status:user",
      actor: ctx.userId,
      limit: 60,
      windowSeconds: 300,
    });

    if (!userLimit.allowed) {
      return {
        ok: false,
        message: "Too many order status changes. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to update order status right now. Please try again shortly.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ order_status: parsed.data.newStatus })
    .eq("id", parsed.data.orderId)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    message: `Order status updated to ${parsed.data.newStatus}.`,
  };
}
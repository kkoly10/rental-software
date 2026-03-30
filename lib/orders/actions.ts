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
import { checkProductAvailability } from "@/lib/availability/check";
import { reserveProductAvailabilityBlock } from "@/lib/availability/blocks";

export type OrderActionState = {
  ok: boolean;
  message: string;
};

function shouldReserveAvailability(status: string) {
  return [
    "awaiting_deposit",
    "confirmed",
    "scheduled",
    "out_for_delivery",
    "delivered",
    "completed",
  ].includes(status);
}

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
    productId: String(formData.get("product_id") ?? ""),
    serviceAreaId: String(formData.get("service_area_id") ?? ""),
    subtotal: String(formData.get("subtotal") ?? "0"),
    deliveryFee: String(formData.get("delivery_fee") ?? "0"),
    depositAmount: String(formData.get("deposit_amount") ?? "0"),
    notes: String(formData.get("notes") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Please review the order details.",
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
    productId,
    serviceAreaId,
    subtotal,
    deliveryFee,
    depositAmount,
    notes,
  } = parsed.data;

  const supabase = await createSupabaseServerClient();

  let resolvedSubtotal = subtotal;
  let resolvedDeliveryFee = deliveryFee;
  let resolvedNotes = notes ?? "";
  let productNameSnapshot = "Rental booking";

  if (productId) {
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, base_price")
      .eq("id", productId)
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (productError || !product) {
      return {
        ok: false,
        message: "Selected product could not be found.",
      };
    }

    productNameSnapshot = product.name ?? productNameSnapshot;

    if (subtotal <= 0) {
      resolvedSubtotal =
        typeof product.base_price === "number" ? Number(product.base_price) : 0;
    }

    if (eventDate && shouldReserveAvailability(orderStatus)) {
      const availability = await checkProductAvailability({
        organizationId: ctx.organizationId,
        productId: product.id,
        eventDate,
      });

      if (!availability.available) {
        return {
          ok: false,
          message:
            availability.reason ??
            "This rental is not available for the selected date.",
        };
      }
    }
  }

  if (serviceAreaId) {
    const { data: serviceArea, error: serviceAreaError } = await supabase
      .from("service_areas")
      .select("id, label, delivery_fee, minimum_order_amount")
      .eq("id", serviceAreaId)
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (serviceAreaError || !serviceArea) {
      return {
        ok: false,
        message: "Selected service area could not be found.",
      };
    }

    resolvedDeliveryFee =
      typeof serviceArea.delivery_fee === "number"
        ? Number(serviceArea.delivery_fee)
        : 0;

    const minimumOrderAmount =
      typeof serviceArea.minimum_order_amount === "number"
        ? Number(serviceArea.minimum_order_amount)
        : 0;

    if (resolvedSubtotal < minimumOrderAmount) {
      return {
        ok: false,
        message: `This service area requires a minimum order of $${minimumOrderAmount.toFixed(
          2
        )}.`,
      };
    }

    resolvedNotes = [resolvedNotes, `Service area: ${serviceArea.label ?? "Service Area"}`]
      .filter(Boolean)
      .join("\n");
  }

  let customerId: string;

  if (email) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("email", email)
      .is("deleted_at", null)
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
        .eq("organization_id", ctx.organizationId)
        .is("deleted_at", null);

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

  const total = Number((resolvedSubtotal + resolvedDeliveryFee).toFixed(2));
  const balance = Number((total - depositAmount).toFixed(2));
  const orderNumber = createOrderNumber();

  const { data: createdOrder, error: orderError } = await supabase
    .from("orders")
    .insert({
      organization_id: ctx.organizationId,
      customer_id: customerId,
      order_number: orderNumber,
      order_status: orderStatus,
      event_date: eventDate ?? null,
      subtotal_amount: resolvedSubtotal,
      delivery_fee_amount: resolvedDeliveryFee,
      total_amount: total,
      deposit_due_amount: depositAmount,
      balance_due_amount: balance,
      notes: resolvedNotes || null,
      source_channel: "dashboard",
    })
    .select("id")
    .single();

  if (orderError || !createdOrder) {
    return {
      ok: false,
      message: orderError?.message ?? "Unable to create order.",
    };
  }

  if (productId) {
    const { error: itemError } = await supabase.from("order_items").insert({
      order_id: createdOrder.id,
      product_id: productId,
      line_type: "rental",
      quantity: 1,
      unit_price: resolvedSubtotal,
      line_total: resolvedSubtotal,
      item_name_snapshot: productNameSnapshot,
    });

    if (itemError) {
      await supabase.from("orders").delete().eq("id", createdOrder.id);
      return {
        ok: false,
        message: itemError.message,
      };
    }
  }

  if (productId && eventDate && shouldReserveAvailability(orderStatus)) {
    const reserveResult = await reserveProductAvailabilityBlock({
      organizationId: ctx.organizationId,
      productId,
      orderId: createdOrder.id,
      eventDate,
    });

    if (!reserveResult.ok) {
      await supabase.from("orders").delete().eq("id", createdOrder.id);
      return {
        ok: false,
        message:
          reserveResult.message ??
          "Unable to reserve availability for the selected date.",
      };
    }
  }

  // Send new order alert to operator (non-blocking)
  import("@/lib/email/triggers").then(({ triggerDashboardOrderEmail }) =>
    triggerDashboardOrderEmail({
      organizationId: ctx.organizationId,
      customerName: `${firstName} ${lastName}`,
      customerEmail: email ?? "",
      orderNumber,
      productName: productNameSnapshot,
      eventDate: eventDate ?? "",
      total,
    }).catch(() => {})
  );

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
      message:
        parsed.error.issues[0]?.message ?? "Invalid order update request.",
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

  // Send status update email to customer (non-blocking)
  import("@/lib/email/triggers").then(({ triggerOrderStatusEmail }) =>
    triggerOrderStatusEmail({
      organizationId: ctx.organizationId,
      orderId: parsed.data.orderId,
      newStatus: parsed.data.newStatus,
    }).catch(() => {})
  );

  return {
    ok: true,
    message: `Order status updated to ${parsed.data.newStatus}.`,
  };
}
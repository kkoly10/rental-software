"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
import { checkPlanLimit } from "@/lib/stripe/gate";

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
    startTime: String(formData.get("start_time") ?? ""),
    endTime: String(formData.get("end_time") ?? ""),
    orderStatus: String(formData.get("order_status") ?? "inquiry"),
    productId: String(formData.get("product_id") ?? ""),
    serviceAreaId: String(formData.get("service_area_id") ?? ""),
    subtotal: String(formData.get("subtotal") ?? "0"),
    deliveryFee: String(formData.get("delivery_fee") ?? "0"),
    depositAmount: String(formData.get("deposit_amount") ?? "0"),
    notes: String(formData.get("notes") ?? ""),
    deliveryLine1: String(formData.get("delivery_line1") ?? ""),
    deliveryCity: String(formData.get("delivery_city") ?? ""),
    deliveryState: String(formData.get("delivery_state") ?? ""),
    deliveryZip: String(formData.get("delivery_zip") ?? ""),
    deliverySurfaceType: String(formData.get("delivery_surface_type") ?? ""),
    deliveryGateCode: String(formData.get("delivery_gate_code") ?? ""),
    deliveryContactName: String(formData.get("delivery_contact_name") ?? ""),
    deliveryContactPhone: String(formData.get("delivery_contact_phone") ?? ""),
    deliverySetupNotes: String(formData.get("delivery_setup_notes") ?? ""),
    deliveryLine2: String(formData.get("delivery_line2") ?? ""),
    rentalEndDate: String(formData.get("rental_end_date") ?? ""),
    smsOptIn: formData.get("sms_opt_in") === "true",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Please review the order details.",
    };
  }

  if (!hasSupabaseEnv()) {
    const orderNumber = createOrderNumber("DEMO");
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
    startTime,
    endTime,
    orderStatus,
    productId,
    serviceAreaId,
    subtotal,
    deliveryFee,
    depositAmount,
    notes,
    deliveryLine1,
    deliveryCity,
    deliveryState,
    deliveryZip,
    deliverySurfaceType,
    deliveryGateCode,
    deliveryContactName,
    deliveryContactPhone,
    deliverySetupNotes,
    deliveryLine2,
    rentalEndDate,
    smsOptIn,
  } = parsed.data;

  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    null;

  const supabase = await createSupabaseServerClient();

  // Plan limit: count orders created this calendar month against the cap.
  // Customer-initiated orders (website checkout) bypass this check —
  // operators shouldn't lose external bookings to a plan ceiling.
  // Soft-deleted orders are excluded so deletions free up the quota.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count: monthOrderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .gte("created_at", monthStart.toISOString())
    .is("deleted_at", null);

  const orderGate = await checkPlanLimit("ordersPerMonth", monthOrderCount ?? 0);
  if (!orderGate.allowed) {
    return { ok: false, message: orderGate.reason ?? "Monthly order limit reached." };
  }

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
        startTime,
        endTime,
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
          ...(smsOptIn
            ? {
                sms_opt_in: true,
                sms_opt_in_at: new Date().toISOString(),
                sms_opt_in_ip: clientIp,
              }
            : {}),
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
          sms_opt_in: smsOptIn,
          sms_opt_in_at: smsOptIn ? new Date().toISOString() : null,
          sms_opt_in_ip: smsOptIn ? clientIp : null,
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
        sms_opt_in: smsOptIn,
        sms_opt_in_at: smsOptIn ? new Date().toISOString() : null,
        sms_opt_in_ip: smsOptIn ? clientIp : null,
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

  const eventStartTime =
    eventDate && startTime
      ? new Date(`${eventDate}T${startTime}:00.000Z`).toISOString()
      : null;
  const eventEndTime =
    eventDate && endTime
      ? new Date(`${eventDate}T${endTime}:00.000Z`).toISOString()
      : null;

  // Create delivery address record if street + city provided
  let deliveryAddressId: string | null = null;
  if (deliveryLine1 && deliveryCity) {
    const { data: addrRow, error: addrErr } = await supabase
      .from("customer_addresses")
      .insert({
        customer_id: customerId,
        line1: deliveryLine1,
        line2: deliveryLine2 ?? null,
        city: deliveryCity,
        state: deliveryState ?? null,
        postal_code: deliveryZip ?? null,
      })
      .select("id")
      .single();

    if (addrErr) {
      console.error("[orders] Failed to create delivery address:", addrErr.message);
    } else if (addrRow) {
      deliveryAddressId = addrRow.id;
    }
  }

  // Helper to clean up the address row if the order creation fails
  const rollbackAddress = async () => {
    if (deliveryAddressId) {
      await supabase.from("customer_addresses").delete().eq("id", deliveryAddressId);
    }
  };

  const { data: createdOrder, error: orderError } = await supabase
    .from("orders")
    .insert({
      organization_id: ctx.organizationId,
      customer_id: customerId,
      order_number: orderNumber,
      order_status: orderStatus,
      event_date: eventDate ?? null,
      rental_end_date: rentalEndDate ?? null,
      event_start_time: eventStartTime,
      event_end_time: eventEndTime,
      subtotal_amount: resolvedSubtotal,
      delivery_fee_amount: resolvedDeliveryFee,
      total_amount: total,
      deposit_due_amount: depositAmount,
      balance_due_amount: balance,
      notes: resolvedNotes || null,
      source_channel: "dashboard",
      delivery_address_id: deliveryAddressId,
      delivery_surface_type: deliverySurfaceType ?? null,
      delivery_gate_code: deliveryGateCode ?? null,
      delivery_contact_name: deliveryContactName ?? null,
      delivery_contact_phone: deliveryContactPhone ?? null,
      delivery_setup_notes: deliverySetupNotes ?? null,
    })
    .select("id")
    .single();

  if (orderError || !createdOrder) {
    await rollbackAddress();
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
      await rollbackAddress();
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
      startTime,
      endTime,
    });

    if (!reserveResult.ok) {
      await supabase.from("orders").delete().eq("id", createdOrder.id);
      await rollbackAddress();
      return {
        ok: false,
        message:
          reserveResult.message ??
          "Unable to reserve availability for the selected date.",
      };
    }
  }

  // Check if this is the operator's first order
  const { count: existingOrderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId);

  const isFirstOrder = (existingOrderCount ?? 0) <= 1;

  try {
    const { markSetupStep } = await import("@/lib/guidance/update-setup-progress");
    await markSetupStep(ctx.organizationId, "has_first_order");
  } catch { /* non-critical */ }

  try {
    const { triggerDashboardOrderEmail } = await import("@/lib/email/triggers");
    await triggerDashboardOrderEmail({
      organizationId: ctx.organizationId,
      customerName: `${firstName} ${lastName}`,
      customerEmail: email ?? "",
      orderNumber,
      productName: productNameSnapshot,
      eventDate: eventDate ?? "",
      total,
    });
  } catch {
    console.error("[orders] Failed to send new order alert for", orderNumber);
  }

  redirect(isFirstOrder ? "/dashboard/orders?first=true" : "/dashboard/orders");
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

  // Release availability blocks when order is cancelled — awaited so inventory is freed immediately
  if (parsed.data.newStatus === "cancelled") {
    try {
      const { releaseOrderAvailability } = await import("@/lib/availability/actions");
      await releaseOrderAvailability(ctx.organizationId, parsed.data.orderId);
    } catch {
      console.error("[orders] Failed to release availability for cancelled order", parsed.data.orderId);
    }
  }

  try {
    const { triggerOrderStatusEmail } = await import("@/lib/email/triggers");
    await triggerOrderStatusEmail({
      organizationId: ctx.organizationId,
      orderId: parsed.data.orderId,
      newStatus: parsed.data.newStatus,
    });
  } catch {
    console.error("[orders] Failed to send status update email for order", parsed.data.orderId);
  }

  try {
    const { sendSmsNotification } = await import("@/lib/sms/send-notification");
    const { data: order } = await supabase
      .from("orders")
      .select("order_number, event_date, customer_id")
      .eq("id", parsed.data.orderId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();

    if (order?.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("phone")
        .eq("id", order.customer_id)
        .maybeSingle();

      if (customer?.phone) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", ctx.organizationId)
          .maybeSingle();

        const businessName = org?.name ?? "Your rental company";
        const status = parsed.data.newStatus;
        const smsContext = { orderId: parsed.data.orderId, customerId: order.customer_id };

        if (status === "awaiting_deposit") {
          await sendSmsNotification("depositReminder", customer.phone, {
            orderNumber: order.order_number,
            amount: "your deposit",
            businessName,
          }, ctx.organizationId, smsContext);
        } else if (status === "confirmed") {
          await sendSmsNotification("orderConfirmation", customer.phone, {
            orderNumber: order.order_number,
            businessName,
          }, ctx.organizationId, smsContext);
        } else if (status === "scheduled") {
          await sendSmsNotification("deliveryScheduled", customer.phone, {
            orderNumber: order.order_number,
            date: order.event_date ?? "your event date",
            timeWindow: "See email for details",
            businessName,
          }, ctx.organizationId, smsContext);
        } else if (status === "out_for_delivery") {
          await sendSmsNotification("deliveryEnRoute", customer.phone, {
            orderNumber: order.order_number,
            eta: "shortly",
            businessName,
          }, ctx.organizationId, smsContext);
        } else if (status === "delivered") {
          await sendSmsNotification("deliveryCompleted", customer.phone, {
            orderNumber: order.order_number,
            businessName,
          }, ctx.organizationId, smsContext);
        }
      }
    }
  } catch {
    console.error("[orders] Failed to send status update SMS for order", parsed.data.orderId);
  }

  revalidatePath(`/dashboard/orders/${parsed.data.orderId}`);
  revalidatePath("/dashboard/orders");

  return {
    ok: true,
    message: `Order status updated to ${parsed.data.newStatus}.`,
  };
}
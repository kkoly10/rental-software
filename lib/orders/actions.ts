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
    requestHeaders.get("x-real-ip") ??
    requestHeaders.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
    null;

  const supabase = await createSupabaseServerClient();

  const { data: createMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(createMembership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to create orders." };
  }

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
        rentalEndDate,
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
      .select("id, first_name, last_name, phone")
      .eq("organization_id", ctx.organizationId)
      .eq("email", email)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;

      // Only fill in blank fields — never overwrite a name or phone the operator
      // already has on record (prevents silent data corruption on repeat bookings).
      const updates: Record<string, unknown> = {};
      if (firstName && !existing.first_name) updates.first_name = firstName;
      if (lastName && !existing.last_name) updates.last_name = lastName;
      if (phone && !existing.phone) updates.phone = phone;
      if (smsOptIn) {
        updates.sms_opt_in = true;
        updates.sms_opt_in_at = new Date().toISOString();
        updates.sms_opt_in_ip = clientIp;
      }

      const { error: updateCustomerError } = Object.keys(updates).length > 0
        ? await supabase
            .from("customers")
            .update(updates)
            .eq("id", customerId)
            .eq("organization_id", ctx.organizationId)
            .is("deleted_at", null)
        : { error: null };

      if (updateCustomerError) {
        console.error("[orders] update customer failed:", updateCustomerError.message);
        return { ok: false, message: "Couldn't update the customer record." };
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
        if (custErr) console.error("[orders] create customer failed:", custErr.message);
        return { ok: false, message: "Failed to create customer." };
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
      if (custErr) console.error("[orders] create customer failed:", custErr.message);
      return { ok: false, message: "Failed to create customer." };
    }

    customerId = newCust.id;
  }

  const total = Number((resolvedSubtotal + resolvedDeliveryFee).toFixed(2));
  // Reject deposits that exceed the order total. Allowing them would
  // produce a negative balance, which the accounting reports and refund
  // flows assume can't happen — silently storing a negative balance
  // corrupts every downstream calculation that reads it.
  if (depositAmount > total + 0.005) {
    return {
      ok: false,
      message: "Deposit amount cannot exceed the order total.",
    };
  }
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
      await supabase.from("customer_addresses").delete().eq("id", deliveryAddressId).eq("customer_id", customerId);
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
    if (orderError) console.error("[orders] create order failed:", orderError.message);
    await rollbackAddress();
    return { ok: false, message: "Unable to create order." };
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
      console.error("[orders] create order item failed:", itemError.message);
      await supabase.from("orders").delete().eq("id", createdOrder.id).eq("organization_id", ctx.organizationId);
      await rollbackAddress();
      return { ok: false, message: "Unable to add items to the order." };
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
      rentalEndDate,
    });

    if (!reserveResult.ok) {
      await supabase.from("orders").delete().eq("id", createdOrder.id).eq("organization_id", ctx.organizationId);
      await rollbackAddress();
      return {
        ok: false,
        message:
          reserveResult.message ??
          "Unable to reserve availability for the selected date.",
      };
    }
  }

  // Check if this is the operator's first order (exclude soft-deleted)
  const { count: existingOrderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);

  const isFirstOrder = (existingOrderCount ?? 0) <= 1;

  try {
    const { markSetupStep } = await import("@/lib/guidance/update-setup-progress");
    await markSetupStep(ctx.organizationId, "has_first_order");
  } catch { /* non-critical */ }

  if (email) {
    try {
      const { triggerDashboardOrderEmail } = await import("@/lib/email/triggers");
      await triggerDashboardOrderEmail({
        organizationId: ctx.organizationId,
        customerName: `${firstName} ${lastName}`,
        customerEmail: email,
        orderNumber,
        productName: productNameSnapshot,
        eventDate: eventDate ?? "",
        total,
      });
    } catch (err) {
      console.error("[orders] Failed to send new order alert for", orderNumber, err instanceof Error ? err.message : err);
    }
  }

  // #PR-C — Same auto-attach behaviour as updateOrderStatus, applied to
  // the new-order path so an operator who picks status="confirmed" in
  // the create form gets the same magic.  Same conservative guards
  // (single non-completed route, address + date, org setting on).
  //
  // Surface the outcome as a query param so the orders list page can
  // render a one-shot toast.  updateOrderStatus appends to its return
  // message because it's an inline action; createOrder redirects, so
  // we ride the URL instead.
  let attachedTo: { routeId: string; routeName: string } | null = null;
  let attachFailed = false;
  if (orderStatus === "confirmed" || orderStatus === "scheduled") {
    try {
      const { autoAttachOrderToRouteIfEligible } = await import(
        "@/lib/routes/auto-attach"
      );
      const result = await autoAttachOrderToRouteIfEligible(
        ctx.organizationId,
        createdOrder.id,
        supabase,
      );
      if (result.attached) {
        attachedTo = { routeId: result.routeId, routeName: result.routeName };
        const { revalidatePath } = await import("next/cache");
        revalidatePath(`/dashboard/deliveries/${result.routeId}`);
        revalidatePath("/dashboard/deliveries");
      } else if (result.reason === "insert_failed") {
        attachFailed = true;
        // Mirror the updateOrderStatus path: log via logAppError so it
        // shows up in the central observability stream, not just stdout.
        try {
          const { logAppError } = await import("@/lib/observability/server");
          await logAppError({
            organizationId: ctx.organizationId,
            source: "orders.createOrder.autoAttach",
            message: "Auto-attach to route failed during order creation",
            context: {
              orderId: createdOrder.id,
              reason: result.reason,
              detail: result.detail,
            },
          });
        } catch { /* logger failures must not break the action */ }
      }
    } catch (err) {
      attachFailed = true;
      console.error(
        "[orders] auto-attach during createOrder failed for",
        createdOrder.id,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const redirectParams = new URLSearchParams();
  if (isFirstOrder) redirectParams.set("first", "true");
  if (attachedTo) {
    redirectParams.set("attached_to_route", attachedTo.routeId);
    redirectParams.set("attached_to_route_name", attachedTo.routeName);
  } else if (attachFailed) {
    redirectParams.set("attach_failed", "1");
  }
  const qs = redirectParams.toString();
  redirect(qs ? `/dashboard/orders?${qs}` : "/dashboard/orders");
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

  const { data: updateMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(updateMembership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to update order status." };
  }

  // Enforce state machine — only allow transitions that make business sense.
  // Automatic transitions (e.g. awaiting_deposit → confirmed on payment) bypass
  // this action and update the DB directly, so they are not affected here.
  // #338 `delivered` must be a valid forward transition from `confirmed`,
  // because crew completion (lib/crew/actions.ts) and route stop completion
  // (lib/routes/actions.ts) both write `delivered` from `confirmed`.
  // #345 `delivered → cancelled` lets operators cancel misdeliveries from
  // the dashboard instead of requiring a manual SQL fix.
  const VALID_TRANSITIONS: Record<string, string[]> = {
    inquiry:          ["quote_sent", "awaiting_deposit", "confirmed", "cancelled"],
    quote_sent:       ["awaiting_deposit", "confirmed", "cancelled"],
    awaiting_deposit: ["confirmed", "cancelled"],
    confirmed:        ["scheduled", "out_for_delivery", "delivered", "cancelled"],
    scheduled:        ["out_for_delivery", "delivered", "cancelled"],
    out_for_delivery: ["delivered", "cancelled"],
    delivered:        ["completed", "cancelled"],
    completed:        [],
    cancelled:        [],
    refunded:         [],
  };

  const { data: currentOrder } = await supabase
    .from("orders")
    .select("order_status")
    .eq("id", parsed.data.orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!currentOrder) {
    return { ok: false, message: "Order not found." };
  }

  const allowed = VALID_TRANSITIONS[currentOrder.order_status] ?? [];
  if (!allowed.includes(parsed.data.newStatus)) {
    return {
      ok: false,
      message: `Cannot move an order from "${currentOrder.order_status}" to "${parsed.data.newStatus}".`,
    };
  }

  // #339 TOCTOU guard — only update if the row is still in the state we
  // validated above, so two concurrent operators can't both pass the
  // VALID_TRANSITIONS check and silently overwrite each other.
  const { data: updated, error } = await supabase
    .from("orders")
    .update({ order_status: parsed.data.newStatus })
    .eq("id", parsed.data.orderId)
    .eq("organization_id", ctx.organizationId)
    .eq("order_status", currentOrder.order_status)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    console.error("[orders] update order status failed:", error.message);
    return { ok: false, message: "Couldn't update order status." };
  }

  if (!updated || updated.length === 0) {
    return {
      ok: false,
      message: "Order status changed while you were editing. Please reload and try again.",
    };
  }

  // Release availability blocks when order is cancelled — awaited so inventory is freed immediately
  if (parsed.data.newStatus === "cancelled") {
    try {
      const { releaseOrderAvailability } = await import("@/lib/availability/actions");
      await releaseOrderAvailability(ctx.organizationId, parsed.data.orderId);
    } catch (err) {
      // #397 surface the failure in the central log so operators can see it,
      // not just stdout where it disappears in production
      const { logAppError } = await import("@/lib/observability/server");
      await logAppError({
        organizationId: ctx.organizationId,
        source: "orders.updateOrderStatus",
        message: "Failed to release availability for cancelled order",
        context: { orderId: parsed.data.orderId, reason: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  try {
    const { triggerOrderStatusEmail } = await import("@/lib/email/triggers");
    await triggerOrderStatusEmail({
      organizationId: ctx.organizationId,
      orderId: parsed.data.orderId,
      newStatus: parsed.data.newStatus,
    });
  } catch (err) {
    // #405 keep the error payload — pass `err`, not a bare string.
    console.error("[orders] status update email failed for", parsed.data.orderId, err instanceof Error ? err.message : err);
  }

  try {
    const { sendSmsNotification } = await import("@/lib/sms/send-notification");
    const { data: order } = await supabase
      .from("orders")
      .select("order_number, event_date, customer_id, deposit_due_amount")
      .eq("id", parsed.data.orderId)
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (order?.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("phone, sms_opt_in")
        .eq("id", order.customer_id)
        .eq("organization_id", ctx.organizationId)
        .is("deleted_at", null)
        .maybeSingle();

      if (customer?.phone && customer?.sms_opt_in) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", ctx.organizationId)
          .is("deleted_at", null)
          .maybeSingle();

        const businessName = org?.name ?? "Your rental company";
        const status = parsed.data.newStatus;
        const smsContext = { orderId: parsed.data.orderId, customerId: order.customer_id };

        if (status === "awaiting_deposit") {
          await sendSmsNotification("depositReminder", customer.phone, {
            orderNumber: order.order_number,
            amount: Number(order.deposit_due_amount ?? 0).toFixed(2),
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
        } else if (status === "cancelled") {
          await sendSmsNotification("orderCancelled", customer.phone, {
            orderNumber: order.order_number,
            businessName,
          }, ctx.organizationId, smsContext);
        }
      }
    }
  } catch (err) {
    // #396 SMS catch was eating the actual error — surface it so SMS
    // provider misconfig is visible.
    console.error("[orders] status update SMS failed for", parsed.data.orderId, err instanceof Error ? err.message : err);
    try {
      const { logAppError } = await import("@/lib/observability/server");
      await logAppError({
        organizationId: ctx.organizationId,
        source: "orders.updateOrderStatus.sms",
        message: "Failed to send status update SMS",
        context: { orderId: parsed.data.orderId, reason: err instanceof Error ? err.message : String(err) },
        error: err,
      });
    } catch { /* logger failures must not break the action */ }
  }

  revalidatePath(`/dashboard/orders/${parsed.data.orderId}`);
  revalidatePath("/dashboard/orders");
  // #346 / #369 — customer portal, delivery board, calendar, and counts
  // tile all read from `orders.order_status`; revalidate so they reflect
  // the new status immediately.
  revalidatePath("/order-status");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/deliveries");
  revalidatePath("/dashboard/calendar");

  // #PR-C — Auto-attach the order to today's route for that date when
  // we transition into `confirmed`.  Conservative: only fires when
  // exactly one non-completed route exists, the order has an event
  // date and a delivery address, and the org hasn't disabled the
  // setting.  Never throws; logs failures and appends success to the
  // response so the operator sees what happened.
  let autoAttachSuffix = "";
  if (parsed.data.newStatus === "confirmed") {
    try {
      const { autoAttachOrderToRouteIfEligible } = await import(
        "@/lib/routes/auto-attach"
      );
      const result = await autoAttachOrderToRouteIfEligible(
        ctx.organizationId,
        parsed.data.orderId,
        supabase,
      );
      if (result.attached) {
        // Unnamed routes are common in newly-created orgs; fall back so
        // the operator doesn't see literal `Added to route "".`.
        const displayName = result.routeName?.trim() || "today's route";
        autoAttachSuffix = ` Added to route "${displayName}".`;
        // Make sure the deliveries surfaces re-render with the new stop.
        revalidatePath(`/dashboard/deliveries/${result.routeId}`);
      } else if (result.reason === "insert_failed") {
        const { logAppError } = await import("@/lib/observability/server");
        await logAppError({
          organizationId: ctx.organizationId,
          source: "orders.updateOrderStatus.autoAttach",
          message: "Auto-attach to route failed during order confirmation",
          context: {
            orderId: parsed.data.orderId,
            reason: result.reason,
            detail: result.detail,
          },
        }).catch(() => {});
      }
    } catch (err) {
      // Status update already succeeded — never block on auto-attach.
      console.error(
        "[orders] auto-attach to route failed for",
        parsed.data.orderId,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return {
    ok: true,
    message: `Order status updated to ${parsed.data.newStatus}.${autoAttachSuffix}`,
  };
}
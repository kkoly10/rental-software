"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { checkoutOrderSchema } from "@/lib/validation/checkout";
import { createOrderNumber } from "@/lib/orders/order-number";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { resolveServiceAreaForAddress } from "@/lib/service-areas/lookup";
import { checkProductAvailability } from "@/lib/availability/check";
import { reserveProductAvailabilityBlock } from "@/lib/availability/blocks";
import { logAppError, logAppEvent } from "@/lib/observability/server";
import { hasStripeEnv, getStripe } from "@/lib/stripe/config";
import { getBookingPolicies } from "@/lib/data/booking-policies";

export type CheckoutFieldErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  eventDate?: string;
};

export type CheckoutActionState = {
  ok: boolean;
  message: string;
  orderNumber?: string;
  fieldErrors?: CheckoutFieldErrors;
  stripeUrl?: string;
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
    startTime: String(formData.get("start_time") ?? ""),
    endTime: String(formData.get("end_time") ?? ""),
    productSlug: String(formData.get("product_slug") ?? ""),
  });

  if (!parsed.success) {
    const fieldErrors: CheckoutFieldErrors = {};
    const fieldMap: Record<string, keyof CheckoutFieldErrors> = {
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      line1: "line1",
      city: "city",
      state: "state",
      postalCode: "postalCode",
      eventDate: "eventDate",
    };
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && key in fieldMap) {
        const mapped = fieldMap[key];
        if (!fieldErrors[mapped]) {
          fieldErrors[mapped] = issue.message;
        }
      }
    }
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Please review your checkout details.",
      fieldErrors,
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
    startTime,
    endTime,
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
      await logAppEvent({
        source: "checkout.website",
        action: "rate_limited",
        status: "warning",
        metadata: { email },
      });

      return {
        ok: false,
        message: "Too many checkout attempts. Please wait a bit and try again.",
      };
    }
  } catch (error) {
    await logAppError({
      source: "checkout.website",
      message: "Checkout rate limit check failed",
      stack: error instanceof Error ? error.stack : undefined,
      context: { email },
    });

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
    await logAppError({
      source: "checkout.website",
      message: "Public checkout missing organization context",
      context: { email },
    });

    return {
      ok: false,
      message:
        "No organization found. An operator must complete onboarding first.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const serviceArea = await resolveServiceAreaForAddress({
    organizationId: orgId,
    postalCode,
    city,
    state,
  });

  if (!serviceArea) {
    await logAppEvent({
      organizationId: orgId,
      source: "checkout.website",
      action: "service_area_not_found",
      status: "warning",
      metadata: { postalCode, city, state },
    });

    return {
      ok: false,
      message:
        "We do not currently serve that delivery area. Please enter a ZIP code within a configured service area.",
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
        typeof product.base_price === "number" ? Number(product.base_price) : 225;
      productId = product.id;
      productName = product.name ?? productSlug;
    }
  }

  if (subtotal < serviceArea.minimumOrderAmount) {
    await logAppEvent({
      organizationId: orgId,
      source: "checkout.website",
      action: "minimum_order_blocked",
      status: "warning",
      metadata: {
        subtotal,
        minimumOrderAmount: serviceArea.minimumOrderAmount,
        serviceAreaId: serviceArea.id,
      },
    });

    return {
      ok: false,
      message: `This service area requires a minimum order of $${serviceArea.minimumOrderAmount.toFixed(
        2
      )}.`,
    };
  }

  // Enforce booking date policies (lead time and max advance)
  if (eventDate) {
    const bookingPolicies = await getBookingPolicies();
    const eventDateMs = new Date(`${eventDate}T00:00:00Z`).getTime();
    const nowMs = Date.now();
    const minDateMs = nowMs + bookingPolicies.bookingLeadTimeHours * 60 * 60 * 1000;
    const maxDateMs = nowMs + bookingPolicies.maxAdvanceBookingDays * 24 * 60 * 60 * 1000;

    if (eventDateMs < minDateMs) {
      return {
        ok: false,
        message: `Bookings require at least ${bookingPolicies.bookingLeadTimeHours} hours advance notice.`,
      };
    }

    if (eventDateMs > maxDateMs) {
      return {
        ok: false,
        message: `Bookings cannot be more than ${bookingPolicies.maxAdvanceBookingDays} days in advance.`,
      };
    }
  }

  if (productId && eventDate) {
    const availability = await checkProductAvailability({
      organizationId: orgId,
      productId,
      eventDate,
      startTime,
      endTime,
    });

    if (!availability.available) {
      await logAppEvent({
        organizationId: orgId,
        source: "checkout.website",
        action: "availability_blocked",
        status: "warning",
        metadata: {
          productId,
          eventDate,
        },
      });

      return {
        ok: false,
        message:
          availability.reason ??
          "This rental is not available for the selected date.",
      };
    }
  }

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
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to update existing customer during checkout",
        context: { customerId, reason: updateCustomerError.message },
      });

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
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to create customer during checkout",
        context: { reason: customerError?.message, email },
      });

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
    await logAppError({
      organizationId: orgId,
      source: "checkout.website",
      message: "Failed to create address during checkout",
      context: { reason: addressError?.message, customerId },
    });

    return {
      ok: false,
      message: addressError?.message ?? "Unable to create address.",
    };
  }

  const deliveryFee = serviceArea.deliveryFee;
  const total = Number((subtotal + deliveryFee).toFixed(2));

  // Compute deposit from the org's configurable booking policies
  const policies = await getBookingPolicies();
  let deposit = Number((total * (policies.depositPercentage / 100)).toFixed(2));
  if (policies.depositMinimum !== null && deposit < policies.depositMinimum) {
    deposit = Math.min(policies.depositMinimum, total);
  }
  const balance = Number((total - deposit).toFixed(2));
  const orderNumber = createOrderNumber();

  // Convert event date + time strings to timestamptz for storage.
  // Times are stored even when availability detection is still date-based,
  // so they flow through to delivery scheduling and the operator dashboard.
  const eventStartTime =
    eventDate && startTime
      ? new Date(`${eventDate}T${startTime}:00.000Z`).toISOString()
      : null;
  const eventEndTime =
    eventDate && endTime
      ? new Date(`${eventDate}T${endTime}:00.000Z`).toISOString()
      : null;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      organization_id: orgId,
      customer_id: customerId,
      order_number: orderNumber,
      order_status: policies.requireDepositToConfirm ? "awaiting_deposit" : "confirmed",
      event_date: eventDate ?? null,
      event_start_time: eventStartTime,
      event_end_time: eventEndTime,
      delivery_address_id: address.id,
      subtotal_amount: subtotal,
      delivery_fee_amount: deliveryFee,
      total_amount: total,
      deposit_due_amount: deposit,
      balance_due_amount: balance,
      source_channel: "website",
      notes: `Service area: ${serviceArea.label}`,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    await logAppError({
      organizationId: orgId,
      source: "checkout.website",
      message: "Failed to create order during checkout",
      context: { reason: orderError?.message, customerId, orderNumber },
    });

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
      await supabase.from("orders").delete().eq("id", order.id);

      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to create order item during checkout",
        context: { reason: itemError.message, orderId: order.id, productId },
      });

      return {
        ok: false,
        message: itemError.message,
      };
    }
  }

  // Use a temporary checkout_hold only when Stripe payment is expected (webhook will convert it).
  // If Stripe isn't configured, use a permanent hold since there's no webhook to convert it.
  const willUseStripe = hasStripeEnv() && deposit > 0;

  if (productId && eventDate) {
    const reserveResult = await reserveProductAvailabilityBlock({
      organizationId: orgId,
      productId,
      orderId: order.id,
      eventDate,
      startTime,
      endTime,
      source: willUseStripe ? "checkout" : "dashboard",
    });

    if (!reserveResult.ok) {
      await supabase.from("orders").delete().eq("id", order.id);

      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to reserve availability block during checkout",
        context: {
          reason: reserveResult.message,
          orderId: order.id,
          productId,
          eventDate,
        },
      });

      return {
        ok: false,
        message:
          reserveResult.message ??
          "Unable to reserve availability for the selected date.",
      };
    }
  }

  await logAppEvent({
    organizationId: orgId,
    source: "checkout.website",
    action: "order_created",
    status: "success",
    metadata: {
      orderId: order.id,
      orderNumber,
      productId,
      serviceAreaId: serviceArea.id,
      eventDate,
    },
  });

  // Track setup progress (non-blocking)
  import("@/lib/guidance/update-setup-progress").then(({ markSetupStep }) =>
    markSetupStep(orgId, "has_first_order")
  ).catch(() => {});

  // Send order confirmation email (non-blocking)
  import("@/lib/email/triggers").then(({ triggerOrderConfirmationEmail }) =>
    triggerOrderConfirmationEmail({
      organizationId: orgId,
      customerFirstName: firstName,
      customerEmail: email,
      orderNumber,
      productName,
      eventDate: eventDate ?? "",
      subtotal,
      deliveryFee,
      total,
      depositDue: deposit,
    }).catch(() => {})
  );

  // Send order confirmation SMS (non-blocking)
  if (phone) {
    import("@/lib/sms/send-notification").then(async ({ sendSmsNotification }) => {
      const { createSupabaseServerClient: createSB } = await import("@/lib/supabase/server");
      const sb = await createSB();
      const { data: org } = await sb
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .maybeSingle();
      await sendSmsNotification("orderConfirmation", phone, {
        orderNumber,
        businessName: org?.name ?? "Your rental company",
      }, orgId);
    }).catch(() => {});
  }

  // Attempt Stripe Checkout for deposit payment
  if (hasStripeEnv() && deposit > 0) {
    try {
      const stripe = getStripe();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Deposit — ${productName}`,
                description: `Order ${orderNumber} deposit`,
              },
              unit_amount: Math.round(deposit * 100),
            },
            quantity: 1,
          },
        ],
        customer_email: email,
        success_url: `${siteUrl}/order-confirmation?order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/order-confirmation?order=${orderNumber}`,
        metadata: {
          organization_id: orgId,
          order_id: order.id,
          order_number: orderNumber,
        },
      });

      if (session.url) {
        return {
          ok: true,
          message: `Order ${orderNumber} created! Redirecting to payment...`,
          orderNumber,
          stripeUrl: session.url,
        };
      }
    } catch (stripeError) {
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Stripe checkout session creation failed — order still created",
        stack: stripeError instanceof Error ? stripeError.stack : undefined,
        context: { orderNumber, deposit },
      });
      // Fall through to non-Stripe confirmation
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
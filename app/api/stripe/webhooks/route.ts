import { NextRequest, NextResponse } from "next/server";
import { getOptionalEnv } from "@/lib/env";
import { getStripe, getPlanByPriceId, hasStripeEnv } from "@/lib/stripe/config";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  if (!hasStripeEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = getOptionalEnv("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 503 }
    );
  }

  let event: Stripe.Event;
  const stripe = getStripe();

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === "subscription" && session.subscription) {
          // SaaS subscription checkout
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(admin, subscription);
        } else if (session.mode === "payment" && session.payment_status === "paid") {
          // Rental order deposit payment — record in the payments table
          const orderId = session.metadata?.order_id;
          const orgId = session.metadata?.organization_id;

          if (!orderId || !orgId) {
            console.error("Stripe webhook: checkout.session.completed missing required metadata", {
              sessionId: session.id,
              hasOrderId: !!orderId,
              hasOrgId: !!orgId,
            });
            break;
          }

          if (orderId && orgId) {
            // Verify the order actually belongs to the claimed org (don't trust client metadata)
            const { data: orderRecord } = await admin
              .from("orders")
              .select("id")
              .eq("id", orderId)
              .eq("organization_id", orgId)
              .maybeSingle();

            if (!orderRecord) {
              console.warn("Stripe webhook: order/org mismatch or order not found", { orderId, orgId });
              break;
            }

            // Resolve payment intent ID; fall back to session ID so dedup and
            // the unique index on (order_id, provider_payment_id) always work
            // even for Stripe sessions where payment_intent is null.
            const paymentIntentId =
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id ?? null;
            const dedupId = paymentIntentId ?? session.id;

            const { count } = await admin
              .from("payments")
              .select("id", { count: "exact", head: true })
              .eq("order_id", orderId)
              .eq("provider_payment_id", dedupId);
            const alreadyRecorded = (count ?? 0) > 0;

            if (!alreadyRecorded) {
              const amountPaid = (session.amount_total ?? 0) / 100;
              const paymentType = session.metadata?.payment_type === "balance" ? "balance" : "deposit";

              // Insert with conflict guard — the unique index on
              // (order_id, provider_payment_id) prevents double-crediting
              // even if the app-level dedup check above has a TOCTOU gap.
              const { error: insertErr } = await admin.from("payments").insert({
                order_id: orderId,
                provider: "stripe",
                provider_payment_id: dedupId,
                payment_type: paymentType,
                payment_status: "paid",
                amount: amountPaid,
                paid_at: new Date().toISOString(),
              });

              // If unique constraint violation, this is a duplicate — skip silently
              if (insertErr?.code === "23505") {
                break;
              }
              if (insertErr) {
                console.error("Payment insert failed:", insertErr.message);
                break;
              }

              // Recompute balance from all payments and sync the cached field
              const { getOrderFinancialsAdmin } = await import(
                "@/lib/payments/financials"
              );
              const financials = await getOrderFinancialsAdmin(admin, orderId);

              if (financials) {
                const updates: Record<string, unknown> = {
                  balance_due_amount: financials.remainingBalance,
                };

                // Auto-confirm if deposit is fulfilled and order is still awaiting
                if (financials.depositFulfilled) {
                  const { data: order } = await admin
                    .from("orders")
                    .select("order_status")
                    .eq("id", orderId)
                    .eq("organization_id", orgId)
                    .maybeSingle();

                  if (order?.order_status === "awaiting_deposit") {
                    updates.order_status = "confirmed";
                  }
                }

                await admin
                  .from("orders")
                  .update(updates)
                  .eq("id", orderId)
                  .eq("organization_id", orgId)
                  .is("deleted_at", null);
              }

              // Convert temporary checkout hold to permanent order hold
              await admin
                .from("availability_blocks")
                .update({ expires_at: null, block_type: "order_hold" })
                .eq("source_order_id", orderId)
                .eq("block_type", "checkout_hold");

              // Send confirmation emails — non-critical, never throws to outer handler
              try {
                const { data: orderData } = await admin
                  .from("orders")
                  .select("order_number, customer_id, balance_due_amount, event_date, subtotal_amount, delivery_fee_amount, total_amount, deposit_due_amount, order_items(item_name_snapshot)")
                  .eq("id", orderId)
                  .eq("organization_id", orgId)
                  .is("deleted_at", null)
                  .maybeSingle();

                if (orderData?.customer_id) {
                  const { data: customer } = await admin
                    .from("customers")
                    .select("first_name, email")
                    .eq("id", orderData.customer_id)
                    .eq("organization_id", orgId)
                    .is("deleted_at", null)
                    .maybeSingle();

                  if (customer?.email) {
                    const { triggerPaymentReceivedEmail, triggerOrderConfirmationEmail } = await import("@/lib/email/triggers");

                    // Order confirmation email (deferred from checkout since Stripe payment was required)
                    if (paymentType === "deposit") {
                      const items = (orderData.order_items as { item_name_snapshot: string }[] | null) ?? [];
                      const productName = items[0]?.item_name_snapshot ?? "Rental";
                      await triggerOrderConfirmationEmail({
                        organizationId: orgId,
                        customerFirstName: customer.first_name ?? "there",
                        customerEmail: customer.email,
                        orderNumber: orderData.order_number,
                        productName,
                        eventDate: orderData.event_date ?? "",
                        subtotal: Number(orderData.subtotal_amount ?? 0),
                        deliveryFee: Number(orderData.delivery_fee_amount ?? 0),
                        total: Number(orderData.total_amount ?? 0),
                        depositDue: Number(orderData.deposit_due_amount ?? 0),
                      }).catch((e: unknown) => console.error("Stripe webhook: order confirmation email failed:", e));
                    }

                    await triggerPaymentReceivedEmail({
                      organizationId: orgId,
                      customerFirstName: customer.first_name ?? "there",
                      customerEmail: customer.email,
                      orderNumber: orderData.order_number,
                      amount: amountPaid,
                      paymentType,
                      paymentMethod: "stripe",
                      newBalance: financials?.remainingBalance ?? Number(orderData.balance_due_amount ?? 0),
                    });
                  }
                }
              } catch (emailErr) {
                console.error("Stripe webhook: payment confirmation email failed:", emailErr);
              }

              // In-app notification for operator
              try {
                const { createNotification } = await import("@/lib/data/notifications");
                const { data: notifOrder } = await admin
                  .from("orders")
                  .select("order_number")
                  .eq("id", orderId)
                  .eq("organization_id", orgId)
                  .is("deleted_at", null)
                  .maybeSingle();
                const orderNumber = notifOrder?.order_number ?? orderId;
                await createNotification(
                  orgId,
                  "payment_received",
                  "Payment received",
                  `$${amountPaid.toFixed(2)} ${paymentType} via Stripe — Order ${orderNumber}`,
                  `/dashboard/orders/${orderId}`
                );
              } catch {
                // Non-critical
              }
            }
          }
        }
        break;
      }

      case "charge.refunded": {
        // Operator issued a refund in the Stripe dashboard — mirror it in the payments table
        // so balance_due_amount stays correct and the dashboard shows the refund.
        const charge = event.data.object as Stripe.Charge;
        const piRef = charge.payment_intent;
        const paymentIntentId =
          typeof piRef === "string" ? piRef : (piRef as { id?: string })?.id ?? null;

        if (!paymentIntentId) break;

        const { data: originalPayment } = await admin
          .from("payments")
          .select("id, order_id, orders!inner(organization_id)")
          .eq("provider_payment_id", paymentIntentId)
          .eq("provider", "stripe")
          .maybeSingle();

        if (!originalPayment) break;
        const refundOrgId = (originalPayment.orders as unknown as { organization_id: string }).organization_id;

        // Process each individual refund object; each has a unique id for dedup
        const refunds = (charge.refunds?.data ?? []) as Array<{ id: string; amount: number }>;
        for (const refund of refunds) {
          const refundKey = `refund_${refund.id}`;
          const { count: existing } = await admin
            .from("payments")
            .select("id", { count: "exact", head: true })
            .eq("order_id", originalPayment.order_id)
            .eq("provider_payment_id", refundKey);

          if ((existing ?? 0) > 0) continue;

          const { error: refundErr } = await admin.from("payments").insert({
            order_id: originalPayment.order_id,
            payment_type: "refund",
            payment_status: "paid",
            amount: refund.amount / 100,
            provider: "stripe",
            provider_payment_id: refundKey,
            paid_at: new Date().toISOString(),
          });

          if (refundErr && refundErr.code !== "23505") {
            console.error("[webhook] charge.refunded: insert failed", refundErr.message);
          }
        }

        // Recompute and sync cached balance
        const { getOrderFinancialsAdmin } = await import("@/lib/payments/financials");
        const refundFinancials = await getOrderFinancialsAdmin(admin, originalPayment.order_id);
        if (refundFinancials) {
          await admin
            .from("orders")
            .update({ balance_due_amount: refundFinancials.remainingBalance })
            .eq("id", originalPayment.order_id)
            .eq("organization_id", refundOrgId)
            .is("deleted_at", null);

          // When all payments have been refunded (net paid ≤ 0), mark the order refunded.
          // Only advance non-terminal statuses — don't overwrite "cancelled".
          if (refundFinancials.totalPaid <= 0) {
            await admin
              .from("orders")
              .update({ order_status: "refunded" })
              .eq("id", originalPayment.order_id)
              .eq("organization_id", refundOrgId)
              .is("deleted_at", null)
              .not("order_status", "in", '("cancelled","refunded")');
          }

          // Send refund notification email to customer
          try {
            const { data: refundOrder } = await admin
              .from("orders")
              .select("order_number, organization_id, customer_id")
              .eq("id", originalPayment.order_id)
              .is("deleted_at", null)
              .maybeSingle();
            if (refundOrder?.customer_id && refundOrder.organization_id) {
              const { data: refundCustomer } = await admin
                .from("customers")
                .select("first_name, email")
                .eq("id", refundOrder.customer_id)
                .eq("organization_id", refundOrgId)
                .is("deleted_at", null)
                .maybeSingle();
              if (refundCustomer?.email) {
                const totalRefunded = refunds.reduce((sum, r) => sum + r.amount, 0) / 100;
                const { triggerPaymentReceivedEmail } = await import("@/lib/email/triggers");
                await triggerPaymentReceivedEmail({
                  organizationId: refundOrder.organization_id,
                  customerFirstName: refundCustomer.first_name ?? "there",
                  customerEmail: refundCustomer.email,
                  orderNumber: refundOrder.order_number,
                  amount: totalRefunded,
                  paymentType: "refund",
                  paymentMethod: "stripe",
                  newBalance: refundFinancials.remainingBalance,
                });
              }
            }
          } catch (refundEmailErr) {
            console.error("[webhook] charge.refunded: refund email failed:", refundEmailErr);
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(admin, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.organization_id;

        if (orgId) {
          const cancelCustomerId = typeof subscription.customer === "string"
            ? subscription.customer
            : (subscription.customer as { id?: string })?.id;
          const { data: cancelOrg } = await admin
            .from("organizations")
            .select("stripe_customer_id")
            .eq("id", orgId)
            .is("deleted_at", null)
            .maybeSingle();
          if (!cancelOrg || (cancelCustomerId && cancelOrg.stripe_customer_id !== cancelCustomerId)) {
            console.warn("[webhook] subscription.deleted: customer mismatch, skipping", { orgId });
            break;
          }
          await admin
            .from("organizations")
            .update({
              stripe_subscription_id: null,
              subscription_status: "canceled",
              subscription_plan: null,
              subscription_current_period_end: null,
              subscription_canceled_at: new Date().toISOString(),
            })
            .eq("id", orgId)
            .is("deleted_at", null);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        // Subscription renewal succeeded — ensure status is synced to "active"
        const successInvoice = event.data.object as Stripe.Invoice;
        const successSubRef = successInvoice.parent?.subscription_details?.subscription;
        const successSubId = typeof successSubRef === "string" ? successSubRef : successSubRef?.id;
        if (successSubId) {
          const subscription = await stripe.subscriptions.retrieve(successSubId);
          await syncSubscription(admin, subscription);
        }
        break;
      }

      case "invoice.payment_failed": {
        // Sync the full subscription state (not just status) so plan tier,
        // period_end, and all cached fields stay consistent with Stripe.
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(admin, subscription);
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }
  } catch (error) {
    console.error(`[stripe-webhook] Handler error for ${event.type}:`, error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  subscription: Stripe.Subscription
) {
  const orgId = subscription.metadata?.organization_id;
  if (!orgId) {
    console.warn("Subscription missing organization_id metadata:", subscription.id);
    return;
  }

  // Cross-reference: verify the org's stored Stripe customer matches this subscription's customer.
  // Guards against metadata inconsistencies — the webhook signature already ensures the event
  // came from our Stripe account, but this catches data drift or copy/paste errors.
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;
  if (customerId) {
    const { data: org } = await admin
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!org || org.stripe_customer_id !== customerId) {
      console.warn("[webhook] syncSubscription: customer mismatch, skipping", {
        orgId,
        expected: org?.stripe_customer_id,
        got: customerId,
      });
      return;
    }
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const planTier = priceId ? getPlanByPriceId(priceId) : null;

  const firstItem = subscription.items.data[0];
  const periodEnd = firstItem?.current_period_end ?? null;

  await admin
    .from("organizations")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_plan: planTier ?? subscription.metadata?.plan_tier ?? null,
      subscription_current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    })
    .eq("id", orgId)
    .is("deleted_at", null);
}

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

          if (orderId && orgId) {
            // Avoid duplicate payment records (idempotency via payment_intent)
            const paymentIntentId =
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id ?? null;

            let alreadyRecorded = false;
            if (paymentIntentId) {
              const { count } = await admin
                .from("payments")
                .select("id", { count: "exact", head: true })
                .eq("order_id", orderId)
                .eq("provider_payment_id", paymentIntentId);
              alreadyRecorded = (count ?? 0) > 0;
            }

            if (!alreadyRecorded) {
              const amountPaid = (session.amount_total ?? 0) / 100;

              await admin.from("payments").insert({
                order_id: orderId,
                provider: "stripe",
                provider_payment_id: paymentIntentId,
                payment_type: "deposit",
                payment_status: "paid",
                amount: amountPaid,
                paid_at: new Date().toISOString(),
              });

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
                    .maybeSingle();

                  if (order?.order_status === "awaiting_deposit") {
                    updates.order_status = "confirmed";
                  }
                }

                await admin
                  .from("orders")
                  .update(updates)
                  .eq("id", orderId);
              }

              // Convert temporary availability hold to permanent (remove expiration)
              await admin
                .from("availability_blocks")
                .update({ expires_at: null })
                .eq("source_order_id", orderId)
                .eq("block_type", "checkout_hold");
            }
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
          await admin
            .from("organizations")
            .update({
              stripe_subscription_id: null,
              subscription_status: "canceled",
              subscription_plan: null,
              subscription_current_period_end: null,
            })
            .eq("id", orgId);
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
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          const orgId = subscription.metadata?.organization_id;

          if (orgId) {
            await admin
              .from("organizations")
              .update({ subscription_status: "past_due" })
              .eq("id", orgId);
          }
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }
  } catch (error) {
    console.error(`Stripe webhook handler error for ${event.type}:`, error);
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
    .eq("id", orgId);
}

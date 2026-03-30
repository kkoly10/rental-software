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
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(admin, subscription);
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

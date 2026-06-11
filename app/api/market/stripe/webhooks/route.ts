import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getOptionalEnv } from "@/lib/env";
import { getStripe, hasStripeEnv } from "@/lib/stripe/config";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { confirmPaidBooking } from "@/lib/market/payment-actions";

export const maxDuration = 60;

/**
 * Marketplace Stripe webhook endpoint — separate from the operator
 * endpoint (build plan Rule 4: a failing operator webhook never blocks
 * marketplace processing, and vice versa). Configure it in Stripe with
 * its own signing secret (STRIPE_MARKET_WEBHOOK_SECRET) and subscribe
 * it to checkout.session.completed / checkout.session.expired.
 *
 * Idempotency: market_stripe_webhook_events mirrors the operator
 * ledger's claim/succeed/fail machine — duplicates no-op, crashed
 * claims can be retried by Stripe's redelivery.
 */
export async function POST(request: NextRequest) {
  if (!hasStripeEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const webhookSecret = getOptionalEnv("STRIPE_MARKET_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Claim — duplicate event ids are dropped here.
  const { error: claimError } = await admin
    .from("market_stripe_webhook_events")
    .insert({ event_id: event.id, event_type: event.type });
  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: "ledger unavailable" }, { status: 500 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.expired"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.market_booking_id;
      const surface = session.metadata?.surface;

      if (surface === "marketplace" && bookingId) {
        if (event.type === "checkout.session.completed") {
          await confirmPaidBooking({
            bookingId,
            paymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : (session.payment_intent?.id ?? null),
          });
        }
        // expired sessions need no action: the renter can create a new
        // session from /market/rentals while the 24h hold lives; the
        // cron cancels the booking when the hold expires.
      }
    }

    await admin
      .from("market_stripe_webhook_events")
      .update({ processing_status: "succeeded", finished_at: new Date().toISOString() })
      .eq("event_id", event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    await admin
      .from("market_stripe_webhook_events")
      .update({
        processing_status: "failed",
        last_error: err instanceof Error ? err.message.slice(0, 500) : "unknown",
        finished_at: new Date().toISOString(),
      })
      .eq("event_id", event.id);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}

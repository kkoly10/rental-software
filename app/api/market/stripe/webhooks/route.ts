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
    // §15 chargebacks (Stripe Connect guidance: reverse the transfer
    // IMMEDIATELY on dispute.created — delay risks platform losses).
    if (event.type === "charge.dispute.created") {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
      const piId =
        typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : (dispute.payment_intent?.id ?? null);

      const { data: booking } = piId
        ? await admin
            .from("market_bookings")
            .select("id")
            .eq("stripe_payment_intent_id", piId)
            .maybeSingle()
        : { data: null };

      let transferReversed = false;
      try {
        const charge = await getStripe().charges.retrieve(chargeId);
        const transferId =
          typeof charge.transfer === "string" ? charge.transfer : charge.transfer?.id;
        if (transferId) {
          await getStripe().transfers.createReversal(transferId);
          transferReversed = true;
        }
      } catch {
        // surfaced via transfer_reversed=false in the trust queue
      }

      await admin.from("market_chargebacks").upsert(
        {
          stripe_dispute_id: dispute.id,
          stripe_charge_id: chargeId,
          booking_id: booking?.id ?? null,
          amount_cents: dispute.amount,
          transfer_reversed: transferReversed,
        },
        { onConflict: "stripe_dispute_id" },
      );
      if (booking?.id) {
        await admin.from("market_booking_events").insert({
          booking_id: booking.id,
          event: "chargeback.opened",
          actor: "system",
          payload: { dispute_id: dispute.id, amount_cents: dispute.amount, transfer_reversed: transferReversed },
        });
      }
    }

    if (event.type === "charge.dispute.closed") {
      const dispute = event.data.object as Stripe.Dispute;
      await admin
        .from("market_chargebacks")
        .update({
          status: dispute.status === "won" ? "won" : "lost",
          resolved_at: new Date().toISOString(),
        })
        .eq("stripe_dispute_id", dispute.id);
    }

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

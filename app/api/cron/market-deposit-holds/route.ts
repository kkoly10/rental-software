import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/security/cron-auth";
import { getStripe, hasStripeEnv } from "@/lib/stripe/config";
import {
  DEPOSIT_HOLD_WINDOW_HOURS,
  decideDepositHold,
} from "@/lib/market/deposit-hold";

export const maxDuration = 60;

/**
 * §9 deposit holds, hourly: for paid bookings whose handoff is within
 * 96h, place a MANUAL-CAPTURE PaymentIntent off-session on the card
 * saved at booking payment. The hold lives on the platform account
 * (refundable deposits carry no platform fee and are never
 * transferred to the seller unless a dispute captures them).
 *
 * Failures mark deposit_status='failed' + a booking event — the §13
 * lifecycle continues; deposit failure is a trust signal for the
 * seller to see, not a silent booking killer.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseServiceRoleEnv() || !hasStripeEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const windowEdge = new Date(
    now.getTime() + DEPOSIT_HOLD_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: candidates } = await admin
    .from("market_bookings")
    .select(
      "id, state, deposit_cents, deposit_status, starts_at, stripe_customer_id, stripe_payment_method_id",
    )
    .eq("deposit_status", "scheduled")
    .lte("starts_at", windowEdge)
    .limit(50);

  let placed = 0;
  let failed = 0;
  const stripe = getStripe();

  for (const b of candidates ?? []) {
    const decision = decideDepositHold(
      {
        state: b.state,
        depositCents: b.deposit_cents,
        depositStatus: b.deposit_status,
        startsAt: new Date(b.starts_at),
        stripeCustomerId: b.stripe_customer_id,
        stripePaymentMethodId: b.stripe_payment_method_id,
      },
      now,
    );

    if (decision.action === "wait") continue;
    if (decision.action === "skip") {
      if (decision.reason === "missing_payment_method") {
        await admin
          .from("market_bookings")
          .update({ deposit_status: "failed", updated_at: now.toISOString() })
          .eq("id", b.id)
          .eq("deposit_status", "scheduled");
        await admin.from("market_booking_events").insert({
          booking_id: b.id,
          event: "deposit.hold_failed",
          actor: "system",
          payload: { reason: decision.reason },
        });
        failed++;
      }
      continue;
    }

    try {
      const intent = await stripe.paymentIntents.create({
        amount: b.deposit_cents,
        currency: "usd",
        customer: b.stripe_customer_id!,
        payment_method: b.stripe_payment_method_id!,
        off_session: true,
        confirm: true,
        capture_method: "manual",
        description: "Refundable rental deposit hold",
        metadata: { surface: "marketplace", market_booking_id: b.id },
      });
      await admin
        .from("market_bookings")
        .update({
          deposit_status: "held",
          stripe_deposit_intent_id: intent.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", b.id)
        .eq("deposit_status", "scheduled");
      await admin.from("market_booking_events").insert({
        booking_id: b.id,
        event: "deposit.held",
        actor: "system",
        payload: { deposit_cents: b.deposit_cents },
      });
      placed++;
    } catch (err) {
      await admin
        .from("market_bookings")
        .update({ deposit_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", b.id)
        .eq("deposit_status", "scheduled");
      await admin.from("market_booking_events").insert({
        booking_id: b.id,
        event: "deposit.hold_failed",
        actor: "system",
        payload: {
          reason: err instanceof Error ? err.message.slice(0, 300) : "unknown",
        },
      });
      failed++;
    }
  }

  return NextResponse.json({ ok: true, placed, failed });
}

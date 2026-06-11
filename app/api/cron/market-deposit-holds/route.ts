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

  // ── Re-auth: card-network auth holds die after ~7 days. For rentals
  // still active 6 days after the hold was placed, cancel + re-place
  // so the deposit never silently lapses mid-rental.
  let reauthed = 0;
  const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
  const { data: aging } = await admin
    .from("market_bookings")
    .select(
      "id, state, deposit_cents, stripe_customer_id, stripe_payment_method_id, stripe_deposit_intent_id, updated_at",
    )
    .eq("deposit_status", "held")
    .in("state", ["confirmed", "ready_for_handoff", "checked_out", "overdue"])
    .lt("updated_at", sixDaysAgo)
    .limit(25);

  for (const b of aging ?? []) {
    if (!b.stripe_customer_id || !b.stripe_payment_method_id || !b.stripe_deposit_intent_id) {
      continue;
    }
    try {
      await stripe.paymentIntents.cancel(b.stripe_deposit_intent_id).catch(() => {
        // already expired/canceled on Stripe's side — fine, re-place below
      });
      const fresh = await stripe.paymentIntents.create({
        amount: b.deposit_cents,
        currency: "usd",
        customer: b.stripe_customer_id,
        payment_method: b.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        capture_method: "manual",
        description: "Refundable rental deposit hold (re-authorization)",
        metadata: { surface: "marketplace", market_booking_id: b.id },
      });
      await admin
        .from("market_bookings")
        .update({ stripe_deposit_intent_id: fresh.id, updated_at: new Date().toISOString() })
        .eq("id", b.id)
        .eq("deposit_status", "held");
      await admin.from("market_booking_events").insert({
        booking_id: b.id,
        event: "deposit.reauthorized",
        actor: "system",
      });
      reauthed++;
    } catch (err) {
      await admin
        .from("market_bookings")
        .update({ deposit_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", b.id)
        .eq("deposit_status", "held");
      await admin.from("market_booking_events").insert({
        booking_id: b.id,
        event: "deposit.reauth_failed",
        actor: "system",
        payload: { reason: err instanceof Error ? err.message.slice(0, 300) : "unknown" },
      });
      failed++;
    }
  }

  // ── Claim-window deposit release (decision 2026-06-11) ────────────
  // Completed bookings keep their deposit auth for 24h so post-return
  // damage discoveries still have a money lever; after the window the
  // hold cancels automatically.
  let released = 0;
  const { data: releasable } = await admin
    .from("market_bookings")
    .select("id, stripe_deposit_intent_id")
    .eq("state", "completed")
    .eq("deposit_status", "held")
    .lt("claim_window_ends_at", now.toISOString())
    .limit(50);
  for (const b of releasable ?? []) {
    try {
      // Bug #9: CAS `held → releasing` BEFORE touching Stripe so a dispute
      // capture racing this cron can't act on the same intent — whoever
      // flips the status first owns the intent.
      const { data: claimed } = await admin
        .from("market_bookings")
        .update({ deposit_status: "releasing", updated_at: new Date().toISOString() })
        .eq("id", b.id)
        .eq("deposit_status", "held")
        .select("id")
        .maybeSingle();
      if (!claimed) continue; // a dispute capture won the race
      if (b.stripe_deposit_intent_id) {
        await stripe.paymentIntents.cancel(b.stripe_deposit_intent_id).catch(() => {});
      }
      await admin
        .from("market_bookings")
        .update({ deposit_status: "released", updated_at: new Date().toISOString() })
        .eq("id", b.id)
        .eq("deposit_status", "releasing");
      await admin.from("market_booking_events").insert({
        booking_id: b.id,
        event: "deposit.released",
        actor: "system",
        payload: { reason: "claim_window_elapsed" },
      });
      released++;
    } catch {
      await admin.from("market_booking_events").insert({
        booking_id: b.id,
        event: "deposit.release_failed",
        actor: "system",
      });
    }
  }

  // ── Late fees (decision record 2026-06-11, Turo model) ────────────
  // Per started late day: 1x daily rate + $20 flat, charged off-session
  // to the saved card as a destination charge (seller gets the daily
  // part, platform keeps its fee % + the $20). Cap 3 days, then a
  // non_return dispute opens automatically.
  const { lateDaysStarted, computeLateFeeCents, LATE_DAYS_CAP, LATE_FLAT_FEE_CENTS } =
    await import("@/lib/market/cancellation");
  const { computePlatformFeeCents } = await import("@/lib/market/fees");

  let lateCharges = 0;
  let escalated = 0;
  const { data: overdueBookings } = await admin
    .from("market_bookings")
    .select(
      "id, ends_at, daily_price_cents, quantity, late_days_charged, late_fee_cents, stripe_customer_id, stripe_payment_method_id, organization_id, listing_id, renter_profile_id",
    )
    .eq("state", "overdue")
    .limit(50);

  // Roadmap item 4: a pending extension request suppresses late-fee
  // accrual (Turo: an approved extension retroactively un-lates the
  // renter — charging fees mid-negotiation guarantees disputes).
  const { data: pendingExt } = await admin
    .from("market_extension_requests")
    .select("booking_id")
    .eq("state", "pending")
    .limit(500);
  const extPending = new Set((pendingExt ?? []).map((e) => e.booking_id));

  for (const b of overdueBookings ?? []) {
    if (extPending.has(b.id)) continue;
    const daysNow = lateDaysStarted(new Date(b.ends_at), now);
    if (daysNow > b.late_days_charged && b.stripe_customer_id && b.stripe_payment_method_id) {
      const targetTotal = computeLateFeeCents({
        dailyPriceCents: b.daily_price_cents,
        quantity: b.quantity,
        lateDays: daysNow,
      });
      const delta = targetTotal - b.late_fee_cents;
      if (delta > 0) {
        try {
          const { data: org } = await admin
            .from("organizations")
            .select("stripe_connect_account_id, business_type")
            .eq("id", b.organization_id)
            .maybeSingle();
          if (org?.stripe_connect_account_id) {
            const sellerKind =
              org.business_type === "marketplace_seller" ? "marketplace" : "korent_operator";
            const newDays = daysNow - b.late_days_charged;
            // Bug #6: the seller gets the daily portion of this delta; the
            // platform keeps its % of that daily portion PLUS the flat
            // $20/day. application_fee = delta − sellerDailyPortion, so the
            // seller is never shorted when the figure is clamped.
            const dailyPart = Math.max(delta - LATE_FLAT_FEE_CENTS * newDays, 0);
            const sellerDailyPortion = dailyPart - computePlatformFeeCents(dailyPart, sellerKind);
            const appFee = Math.min(Math.max(delta - sellerDailyPortion, 0), delta);
            await stripe.paymentIntents.create(
              {
                amount: delta,
                currency: "usd",
                customer: b.stripe_customer_id,
                payment_method: b.stripe_payment_method_id,
                off_session: true,
                confirm: true,
                application_fee_amount: appFee,
                transfer_data: { destination: org.stripe_connect_account_id },
                description: "Late return fee",
                metadata: { surface: "marketplace", market_booking_id: b.id, kind: "late_fee" },
              },
              // Bug #2: idempotency key per (booking, late-day count) so a
              // crash between charge and DB write can't re-bill the same day.
              { idempotencyKey: `late_fee_${b.id}_${daysNow}` },
            );
            // Bug #3: state-guard the write so a concurrent return/cancel/
            // dispute that left `overdue` doesn't get a late fee stamped.
            await admin
              .from("market_bookings")
              .update({
                late_fee_cents: targetTotal,
                late_days_charged: daysNow,
                updated_at: new Date().toISOString(),
              })
              .eq("id", b.id)
              .eq("state", "overdue")
              .eq("late_days_charged", b.late_days_charged);
            await admin.from("market_booking_events").insert({
              booking_id: b.id,
              event: "late_fee.charged",
              actor: "system",
              payload: { days: daysNow, total_cents: targetTotal },
            });
            lateCharges++;
          }
        } catch (err) {
          await admin.from("market_booking_events").insert({
            booking_id: b.id,
            event: "late_fee.charge_failed",
            actor: "system",
            payload: { reason: err instanceof Error ? err.message.slice(0, 200) : "unknown" },
          });
        }
      }
    }

    // 3 late days reached → automatic non_return dispute (once).
    if (daysNow >= LATE_DAYS_CAP) {
      const { data: existing } = await admin
        .from("market_disputes")
        .select("id")
        .eq("booking_id", b.id)
        .eq("dispute_type", "non_return")
        .maybeSingle();
      if (!existing) {
        const { data: dispute } = await admin
          .from("market_disputes")
          .insert({
            booking_id: b.id,
            opened_by: "system",
            dispute_type: "non_return",
            description:
              "Automatic escalation: rental is 3+ days overdue after late fees. Review deposit capture and recovery.",
            status: "admin_review",
          })
          .select("id")
          .single();
        if (dispute) {
          await admin
            .from("market_bookings")
            .update({ state: "disputed", updated_at: new Date().toISOString() })
            .eq("id", b.id)
            .eq("state", "overdue");
          escalated++;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, placed, failed, reauthed, released, lateCharges, escalated });
}

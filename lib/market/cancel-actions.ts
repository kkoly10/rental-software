"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { canTransition, type BookingState } from "@/lib/market/booking-state";
import {
  computeRenterCancellationRefund,
  computeRenterNoShowRefund,
} from "@/lib/market/cancellation";

/**
 * Cancellation / no-show actions (decision record 2026-06-11).
 *
 * Refund mechanics: one Stripe call —
 *   refunds.create({ payment_intent, amount, reverse_transfer: true,
 *                    refund_application_fee: true })
 * Destination charges make this exactly proportional: the seller's
 * transfer and the platform's fee (incl. facilitator tax) reverse in
 * the same ratio as the refund. The §9 deposit auth is released 100%
 * on EVERY cancellation path.
 */

export type CancelActionState = { ok: boolean; message: string };

const PAID_STATES: BookingState[] = ["confirmed", "ready_for_handoff"];
const NO_SHOW_AFTER_MS = 30 * 60 * 1000; // Turo's 30-minute rule

type BookingRow = {
  id: string;
  state: string;
  hold_id: string | null;
  renter_profile_id: string;
  organization_id: string;
  listing_id: string;
  starts_at: string;
  created_at: string;
  quantity: number;
  rental_days: number;
  daily_price_cents: number;
  subtotal_cents: number;
  tax_cents: number;
  deposit_status: string;
  stripe_payment_intent_id: string | null;
  stripe_deposit_intent_id: string | null;
  refund_cents: number | null;
  market_listings: { risk_family_slug: string } | null;
};

const BOOKING_SELECT =
  "id, state, hold_id, renter_profile_id, organization_id, listing_id, starts_at, created_at, quantity, rental_days, daily_price_cents, subtotal_cents, tax_cents, deposit_status, stripe_payment_intent_id, stripe_deposit_intent_id, refund_cents, market_listings ( risk_family_slug )";

async function rateLimited(scope: string): Promise<boolean> {
  try {
    const key = await getActionClientKey();
    const r = await enforceRateLimit({ scope, actor: key, limit: 10, windowSeconds: 600, strict: true });
    return !r.allowed;
  } catch {
    return true;
  }
}

async function getAdmin() {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  return createSupabaseAdminClient();
}

async function refundPaymentProportional(
  booking: BookingRow,
  refundCents: number,
): Promise<boolean> {
  if (refundCents <= 0) return true;
  if (!booking.stripe_payment_intent_id) return false;
  try {
    const { getStripe, hasStripeEnv } = await import("@/lib/stripe/config");
    if (!hasStripeEnv()) return false;
    await getStripe().refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      amount: refundCents,
      reverse_transfer: true,
      refund_application_fee: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function releaseDepositIfHeld(
  admin: Awaited<ReturnType<typeof getAdmin>>,
  booking: BookingRow,
): Promise<void> {
  if (booking.deposit_status !== "held" || !booking.stripe_deposit_intent_id) {
    // 'scheduled' deposits simply stop being eligible once cancelled.
    if (booking.deposit_status === "scheduled") {
      await admin
        .from("market_bookings")
        .update({ deposit_status: "released" })
        .eq("id", booking.id)
        .eq("deposit_status", "scheduled");
    }
    return;
  }
  try {
    const { getStripe, hasStripeEnv } = await import("@/lib/stripe/config");
    if (hasStripeEnv()) {
      await getStripe().paymentIntents.cancel(booking.stripe_deposit_intent_id);
    }
    await admin
      .from("market_bookings")
      .update({ deposit_status: "released" })
      .eq("id", booking.id)
      .eq("deposit_status", "held");
  } catch {
    await admin.from("market_booking_events").insert({
      booking_id: booking.id,
      event: "deposit.release_failed",
      actor: "system",
    });
  }
}

/**
 * Bug #4/#5/#7 fix: do the state-guarded cancel FIRST (compare-and-swap),
 * and only the winner issues the refund — so a concurrent cancel/no-show
 * can never double-refund, and a retry after a DB hiccup can't re-refund
 * (the CAS already moved the state, so the retry loses). Returns whether
 * this call won the cancellation.
 */
async function finalizeCancellation(
  admin: Awaited<ReturnType<typeof getAdmin>>,
  booking: BookingRow,
  input: {
    cancelledBy: "renter" | "seller";
    reason: string;
    refundCents: number;
    actor: "renter" | "seller" | "system";
    event: string;
  },
): Promise<{ won: boolean; refunded: number }> {
  // CAS to cancelled. Loser (0 rows) bails before any money moves.
  const { data: won } = await admin
    .from("market_bookings")
    .update({
      state: "cancelled",
      cancelled_by: input.cancelledBy,
      cancel_reason: input.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("state", booking.state)
    .select("id")
    .maybeSingle();
  if (!won) return { won: false, refunded: 0 };

  // Refund AFTER winning the CAS → exactly-once.
  let refunded = 0;
  if (input.refundCents > 0) {
    const ok = await refundPaymentProportional(booking, input.refundCents);
    if (ok) {
      refunded = input.refundCents;
      await admin
        .from("market_bookings")
        .update({ refund_cents: (booking.refund_cents ?? 0) + refunded })
        .eq("id", booking.id);
    } else {
      await admin.from("market_booking_events").insert({
        booking_id: booking.id,
        event: "refund.failed",
        actor: "system",
        payload: { intended_cents: input.refundCents, reason: input.reason },
      });
    }
  }

  if (booking.hold_id) {
    await admin
      .from("market_reservation_holds")
      .update({ state: "released", updated_at: new Date().toISOString() })
      .eq("id", booking.hold_id);
  }

  await releaseDepositIfHeld(admin, booking);

  await admin.from("market_booking_events").insert({
    booking_id: booking.id,
    event: input.event,
    actor: input.actor,
    payload: { reason: input.reason, refund_cents: refunded },
  });

  // §27: cancelled-after-confirmation must cancel the fulfillment
  // projection.
  if (PAID_STATES.includes(booking.state as BookingState)) {
    try {
      const { emitBridgeEvent } = await import("@/lib/market/bridge");
      await emitBridgeEvent({
        event: "marketplace.booking.cancelled",
        bookingId: booking.id,
        organizationId: booking.organization_id,
      });
    } catch {
      // best-effort
    }
  }

  // §24: the party who DIDN'T act gets told.
  try {
    const { getBookingPartyEmails, notifyMarketEmail } = await import("@/lib/market/notify");
    const party = await getBookingPartyEmails(booking.id);
    if (party) {
      void notifyMarketEmail({
        kind: "booking_cancelled",
        to: input.actor === "renter" ? party.sellerEmail : party.renterEmail,
        listingTitle: party.listingTitle,
        startsAt: party.startsAt,
        endsAt: party.endsAt,
        extra:
          refunded > 0
            ? `A refund of $${(refunded / 100).toFixed(2)} was issued.`
            : undefined,
      });
    }
  } catch {
    // best-effort
  }

  revalidatePath("/market/rentals");
  revalidatePath("/dashboard/marketplace");
  return { won: true, refunded };
}

async function loadBooking(
  admin: Awaited<ReturnType<typeof getAdmin>>,
  bookingId: string,
): Promise<BookingRow | null> {
  const { data } = await admin
    .from("market_bookings")
    .select(BOOKING_SELECT)
    .eq("id", bookingId)
    .maybeSingle();
  return (data as unknown as BookingRow | null) ?? null;
}

// ── Renter cancellation ───────────────────────────────────────────────

export async function renterCancelBooking(
  _prev: CancelActionState,
  formData: FormData,
): Promise<CancelActionState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!z.string().uuid().safeParse(bookingId).success || !hasSupabaseEnv()) {
    return { ok: false, message: "Invalid booking." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };
  if (await rateLimited("market:cancel")) {
    return { ok: false, message: "Too many attempts — try again shortly." };
  }

  const admin = await getAdmin();
  const booking = await loadBooking(admin, bookingId);
  if (!booking || booking.renter_profile_id !== user.id) {
    return { ok: false, message: "Booking not found." };
  }
  const state = booking.state as BookingState;
  if (!canTransition(state, "cancelled")) {
    return { ok: false, message: "This booking can no longer be cancelled — open a dispute instead." };
  }

  // Unpaid states: free cancel, nothing to refund.
  if (!PAID_STATES.includes(state)) {
    await finalizeCancellation(admin, booking, {
      cancelledBy: "renter",
      reason: "renter_cancelled",
      refundCents: 0,
      actor: "renter",
      event: "booking.cancelled",
    });
    return { ok: true, message: "Request cancelled — you were never charged." };
  }

  const charged = booking.subtotal_cents + (booking.tax_cents ?? 0);
  const decision = computeRenterCancellationRefund({
    riskFamilySlug: booking.market_listings?.risk_family_slug ?? "",
    startsAt: new Date(booking.starts_at),
    bookedAt: new Date(booking.created_at),
    now: new Date(),
    chargedCents: charged,
  });

  const result = await finalizeCancellation(admin, booking, {
    cancelledBy: "renter",
    reason: `renter_cancelled_${decision.presetName}_${decision.pct}pct`,
    refundCents: decision.refundCents,
    actor: "renter",
    event: "booking.cancelled",
  });
  if (!result.won) {
    return { ok: false, message: "This booking was already updated — refresh to see its status." };
  }
  if (decision.refundCents > 0 && result.refunded === 0) {
    return { ok: false, message: "Cancelled, but the refund didn't go through — support will sort it out." };
  }

  return {
    ok: true,
    message:
      decision.pct === 100
        ? "Cancelled — full refund (including deposit release) is on its way."
        : decision.pct === 50
          ? "Cancelled — 50% refunded per this category's policy; your deposit hold is released."
          : "Cancelled inside the no-refund window — your deposit hold is released, but the payment is not refundable.",
  };
}

// ── Seller cancellation (renter always made whole) ────────────────────

export async function sellerCancelBooking(
  _prev: CancelActionState,
  formData: FormData,
): Promise<CancelActionState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!z.string().uuid().safeParse(bookingId).success || !hasSupabaseEnv()) {
    return { ok: false, message: "Invalid booking." };
  }
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Sign in first." };
  if (await rateLimited("market:cancel")) {
    return { ok: false, message: "Too many attempts — try again shortly." };
  }

  const admin = await getAdmin();
  const booking = await loadBooking(admin, bookingId);
  if (!booking || booking.organization_id !== ctx.organizationId) {
    return { ok: false, message: "Booking not found." };
  }
  const state = booking.state as BookingState;
  if (!canTransition(state, "cancelled")) {
    return { ok: false, message: "This booking can no longer be cancelled." };
  }

  const refund = PAID_STATES.includes(state)
    ? booking.subtotal_cents + (booking.tax_cents ?? 0)
    : 0;
  // Seller cancels count against ranking (cancelled_by='seller' feeds
  // the §21 stats) and are tracked for future Turo-style fees.
  const result = await finalizeCancellation(admin, booking, {
    cancelledBy: "seller",
    reason: "seller_cancelled",
    refundCents: refund,
    actor: "seller",
    event: "booking.seller_cancelled",
  });
  if (!result.won) {
    return { ok: false, message: "This booking was already updated — refresh to see its status." };
  }
  if (refund > 0 && result.refunded === 0) {
    return { ok: false, message: "Cancelled, but the refund didn't process — support will resolve it." };
  }

  return {
    ok: true,
    message:
      "Cancelled. The renter is fully refunded — repeated seller cancellations lower your ranking.",
  };
}

// ── No-shows (Turo model) ─────────────────────────────────────────────

export async function reportSellerNoShow(
  _prev: CancelActionState,
  formData: FormData,
): Promise<CancelActionState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!z.string().uuid().safeParse(bookingId).success || !hasSupabaseEnv()) {
    return { ok: false, message: "Invalid booking." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };
  if (await rateLimited("market:noshow")) {
    return { ok: false, message: "Too many attempts." };
  }

  const admin = await getAdmin();
  const booking = await loadBooking(admin, bookingId);
  if (!booking || booking.renter_profile_id !== user.id) {
    return { ok: false, message: "Booking not found." };
  }
  if (!PAID_STATES.includes(booking.state as BookingState)) {
    return { ok: false, message: "No-show reports apply to confirmed bookings only." };
  }
  if (Date.now() < new Date(booking.starts_at).getTime() + NO_SHOW_AFTER_MS) {
    return { ok: false, message: "Give the seller 30 minutes past the start time first." };
  }

  const refund = booking.subtotal_cents + (booking.tax_cents ?? 0);
  const result = await finalizeCancellation(admin, booking, {
    cancelledBy: "seller",
    reason: "seller_no_show",
    refundCents: refund,
    actor: "renter",
    event: "booking.seller_no_show",
  });
  if (!result.won) return { ok: false, message: "This booking was already updated — refresh." };
  if (result.refunded === 0) return { ok: false, message: "Reported, but the refund didn't process — contact support." };
  return { ok: true, message: "Reported — you're fully refunded and the deposit hold is released." };
}

export async function reportRenterNoShow(
  _prev: CancelActionState,
  formData: FormData,
): Promise<CancelActionState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!z.string().uuid().safeParse(bookingId).success || !hasSupabaseEnv()) {
    return { ok: false, message: "Invalid booking." };
  }
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Sign in first." };
  if (await rateLimited("market:noshow")) {
    return { ok: false, message: "Too many attempts." };
  }

  const admin = await getAdmin();
  const booking = await loadBooking(admin, bookingId);
  if (!booking || booking.organization_id !== ctx.organizationId) {
    return { ok: false, message: "Booking not found." };
  }
  if (!PAID_STATES.includes(booking.state as BookingState)) {
    return { ok: false, message: "No-show reports apply to confirmed bookings only." };
  }
  if (Date.now() < new Date(booking.starts_at).getTime() + NO_SHOW_AFTER_MS) {
    return { ok: false, message: "Give the renter 30 minutes past the start time first." };
  }

  // Bug #10: compute the seller's "keep" on the SUBTOTAL, then refund
  // the remaining subtotal PLUS its proportional tax — so the renter
  // isn't shorted tax on the refunded portion.
  const subtotal = booking.subtotal_cents;
  const tax = booking.tax_cents ?? 0;
  const { refundCents: subtotalRefund, sellerKeepsCents } = computeRenterNoShowRefund({
    dailyPriceCents: booking.daily_price_cents,
    quantity: booking.quantity,
    rentalDays: booking.rental_days,
    chargedCents: subtotal,
  });
  const taxRefund = subtotal > 0 ? Math.round((tax * subtotalRefund) / subtotal) : 0;
  const refundCents = subtotalRefund + taxRefund;

  const result = await finalizeCancellation(admin, booking, {
    cancelledBy: "renter",
    reason: "renter_no_show",
    refundCents,
    actor: "seller",
    event: "booking.renter_no_show",
  });
  if (!result.won) return { ok: false, message: "This booking was already updated — refresh." };
  if (refundCents > 0 && result.refunded === 0) {
    return { ok: false, message: "Recorded, but the renter refund didn't process — contact support." };
  }
  return {
    ok: true,
    message: `Recorded. You keep $${(sellerKeepsCents / 100).toFixed(2)} (Turo-model no-show compensation); the rest refunds to the renter.`,
  };
}

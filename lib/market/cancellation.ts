import type { RiskFamilySlug } from "@/lib/market/registry";

/**
 * Cancellation/refund policy engine — pure and deterministic.
 *
 * Decision record (2026-06-11, researched against Turo/Airbnb):
 *  - presets by risk family (slightly stricter than Turo for
 *    high-value/towable, looser than Airbnb-Firm elsewhere):
 *      Flexible: 100% until 24h before handoff, 50% until handoff
 *      Standard: 100% until 72h, 50% until 24h
 *      Strict:   100% until 7 days, 50% until 72h
 *  - universal 1-hour grace after booking: always 100%
 *  - the refundable deposit is released 100% on EVERY cancellation
 *  - platform fee + facilitator tax refund proportionally (the Stripe
 *    refund uses reverse_transfer + refund_application_fee, which is
 *    exactly proportional)
 *  - no-shows (Turo model): seller no-show → renter 100%; renter
 *    no-show → seller keeps 1 day (75% of the day for single-day
 *    rentals), rest refunds
 *  - late returns (Turo model, simplified): 2h grace, then per started
 *    late day 1× daily rate + $20 flat, capped at 3 days, then it
 *    escalates to a non_return dispute
 */

export type CancellationPreset = {
  name: "flexible" | "standard" | "strict";
  fullRefundHoursBefore: number;
  partialRefundHoursBefore: number;
  partialPct: number; // 0-100
};

const FLEXIBLE: CancellationPreset = {
  name: "flexible",
  fullRefundHoursBefore: 24,
  partialRefundHoursBefore: 0,
  partialPct: 50,
};
const STANDARD: CancellationPreset = {
  name: "standard",
  fullRefundHoursBefore: 72,
  partialRefundHoursBefore: 24,
  partialPct: 50,
};
const STRICT: CancellationPreset = {
  name: "strict",
  fullRefundHoursBefore: 7 * 24,
  partialRefundHoursBefore: 72,
  partialPct: 50,
};

const PRESET_BY_FAMILY: Record<RiskFamilySlug, CancellationPreset> = {
  "passive-standard": FLEXIBLE,
  "furniture-standard": FLEXIBLE,
  "electronics-standard": FLEXIBLE,
  "restoration-and-emergency": FLEXIBLE,
  "powered-standard": STANDARD,
  "food-contact": STANDARD,
  "baby-sensitive": STANDARD,
  "multi-component-event": STANDARD,
  "high-value-electronics": STRICT,
  "towable-road": STRICT,
  "manual-review-restricted": STRICT,
};

export function cancellationPresetForFamily(slug: string): CancellationPreset {
  return PRESET_BY_FAMILY[slug as RiskFamilySlug] ?? STANDARD;
}

export const POST_BOOKING_GRACE_MS = 60 * 60 * 1000; // 1 hour

export type RefundDecision = {
  pct: number; // 0-100 of the total charge (subtotal + tax)
  refundCents: number; // amount to refund against the payment
  presetName: CancellationPreset["name"];
};

/** Renter-initiated cancellation refund (paid bookings). */
export function computeRenterCancellationRefund(input: {
  riskFamilySlug: string;
  startsAt: Date;
  bookedAt: Date;
  now: Date;
  chargedCents: number; // subtotal + tax (what the renter paid)
}): RefundDecision {
  const preset = cancellationPresetForFamily(input.riskFamilySlug);

  let pct: number;
  if (input.now.getTime() - input.bookedAt.getTime() <= POST_BOOKING_GRACE_MS) {
    pct = 100; // universal grace window
  } else {
    const hoursBefore =
      (input.startsAt.getTime() - input.now.getTime()) / (60 * 60 * 1000);
    if (hoursBefore >= preset.fullRefundHoursBefore) pct = 100;
    else if (hoursBefore >= preset.partialRefundHoursBefore) pct = preset.partialPct;
    else pct = 0;
  }

  return {
    pct,
    refundCents: Math.round((Math.max(input.chargedCents, 0) * pct) / 100),
    presetName: preset.name,
  };
}

/** Renter no-show: seller keeps one day (75% for single-day rentals). */
export function computeRenterNoShowRefund(input: {
  dailyPriceCents: number;
  quantity: number;
  rentalDays: number;
  chargedCents: number;
}): { sellerKeepsCents: number; refundCents: number } {
  const dayValue = input.dailyPriceCents * input.quantity;
  const keep =
    input.rentalDays > 1 ? dayValue : Math.round(dayValue * 0.75);
  const clampedKeep = Math.min(keep, input.chargedCents);
  return {
    sellerKeepsCents: clampedKeep,
    refundCents: input.chargedCents - clampedKeep,
  };
}

// ── Late returns ──────────────────────────────────────────────────────

export const LATE_GRACE_MS = 2 * 60 * 60 * 1000; // 2 hours
export const LATE_FLAT_FEE_CENTS = 2_000; // $20 per started late day
export const LATE_DAYS_CAP = 3; // then escalate to non_return dispute

export function lateDaysStarted(endsAt: Date, now: Date): number {
  const lateMs = now.getTime() - endsAt.getTime() - LATE_GRACE_MS;
  if (lateMs <= 0) return 0;
  return Math.min(Math.ceil(lateMs / (24 * 60 * 60 * 1000)), LATE_DAYS_CAP);
}

export function computeLateFeeCents(input: {
  dailyPriceCents: number;
  quantity: number;
  lateDays: number;
}): number {
  const days = Math.min(Math.max(input.lateDays, 0), LATE_DAYS_CAP);
  return days * (input.dailyPriceCents * input.quantity + LATE_FLAT_FEE_CENTS);
}

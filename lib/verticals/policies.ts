import { getVertical } from "./registry.ts";
import type { VerticalPolicies } from "./types.ts";

/**
 * PR-2b — per-vertical booking/cancellation policy resolution.
 *
 * Pure functions only: the portal cancel action and the checkout
 * lead-time gate both call these, and the unit suite pins the math
 * without a DB.
 */

/** Conservative fallback when an order can't be attributed to a
 *  registered vertical (legacy data, deleted category): fully
 *  refundable until 1 day out, org lead time governs. Matches the
 *  pre-policy behavior so unknown verticals don't get stricter. */
export const DEFAULT_POLICIES: VerticalPolicies = {
  refundWindowDays: 1,
  forfeitPct: 0,
  minLeadTimeHours: 0,
};

export function resolveVerticalPolicies(
  verticalSlug: string | null | undefined
): VerticalPolicies {
  if (!verticalSlug) return DEFAULT_POLICIES;
  return getVertical(verticalSlug)?.policies ?? DEFAULT_POLICIES;
}

/** Effective lead time at checkout: the org can be stricter than the
 *  vertical floor, never looser. */
export function effectiveLeadTimeHours(
  orgLeadTimeHours: number,
  policies: VerticalPolicies
): number {
  return Math.max(orgLeadTimeHours, policies.minLeadTimeHours);
}

export type CancellationOutcome = {
  /** True when the cancellation is INSIDE the refund window (close
   *  to the event) and the forfeit applies. */
  insideWindow: boolean;
  /** Dollars refunded to the customer (never negative). */
  refundAmount: number;
  /** Dollars of deposit forfeited to the operator. */
  forfeitAmount: number;
};

/**
 * Compute what a cancellation refunds given the vertical policy.
 *
 * `eventDate` is the order's YYYY-MM-DD calendar day; "days until
 * event" counts whole days from `now` to that day's UTC midnight,
 * floored — cancelling 6.5 days before a tent's 7-day window is
 * inside the window (6 < 7), matching how customers read "within
 * 7 days of the event".
 *
 * Cents-safe: forfeit is rounded to the cent, refund is the exact
 * complement so refund + forfeit always equals the deposit.
 */
export function computeCancellationOutcome(params: {
  depositPaid: number;
  eventDate: string | null;
  policies: VerticalPolicies;
  now?: Date;
}): CancellationOutcome {
  const { depositPaid, eventDate, policies } = params;
  const now = params.now ?? new Date();

  const paidCents = Math.round(Math.max(0, depositPaid) * 100);
  if (paidCents === 0) {
    return { insideWindow: false, refundAmount: 0, forfeitAmount: 0 };
  }

  let insideWindow = false;
  if (eventDate) {
    const eventMs = new Date(`${eventDate}T00:00:00Z`).getTime();
    if (!Number.isNaN(eventMs)) {
      const daysUntil = Math.floor((eventMs - now.getTime()) / 86_400_000);
      insideWindow = daysUntil < policies.refundWindowDays;
    }
  }

  // Clamp forfeitPct into [0, 100]: a negative value (operator typo)
  // would otherwise pass the `<= 0` short-circuit below and silently
  // grant a full refund inside the window; >100 would push the
  // refund negative.
  const forfeitPct = Math.max(0, Math.min(100, policies.forfeitPct));

  if (!insideWindow || forfeitPct === 0) {
    return {
      insideWindow,
      refundAmount: paidCents / 100,
      forfeitAmount: 0,
    };
  }

  const forfeitCents = Math.round((paidCents * forfeitPct) / 100);
  return {
    insideWindow,
    refundAmount: (paidCents - forfeitCents) / 100,
    forfeitAmount: forfeitCents / 100,
  };
}

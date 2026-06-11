/**
 * §9 deposit-hold timing — pure decision logic, unit-tested, shared by
 * the hourly cron and any future manual "place hold now" admin action.
 *
 * The deposit secures the RENTAL PERIOD, not the booking: the auth
 * hold is placed at handoff minus <= 96 hours regardless of when the
 * booking was made (spec §9 as revised). Card-network auth holds
 * live ~7 days, so 96h + rental keeps short rentals inside one auth
 * window; long rentals re-auth later (flagged, not yet built).
 */

export const DEPOSIT_HOLD_WINDOW_HOURS = 96;

export type DepositHoldCandidate = {
  state: string;
  depositCents: number;
  depositStatus: string;
  startsAt: Date;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
};

export type DepositHoldDecision =
  | { action: "place" }
  | { action: "wait"; reason: "window_not_open" }
  | {
      action: "skip";
      reason: "no_deposit" | "wrong_status" | "wrong_state" | "missing_payment_method";
    };

const HOLDABLE_STATES = ["confirmed", "ready_for_handoff"];

export function decideDepositHold(
  candidate: DepositHoldCandidate,
  now: Date,
): DepositHoldDecision {
  if (candidate.depositCents <= 0) return { action: "skip", reason: "no_deposit" };
  if (candidate.depositStatus !== "scheduled") {
    return { action: "skip", reason: "wrong_status" };
  }
  if (!HOLDABLE_STATES.includes(candidate.state)) {
    return { action: "skip", reason: "wrong_state" };
  }
  if (!candidate.stripeCustomerId || !candidate.stripePaymentMethodId) {
    return { action: "skip", reason: "missing_payment_method" };
  }
  const windowOpensAt = new Date(
    candidate.startsAt.getTime() - DEPOSIT_HOLD_WINDOW_HOURS * 60 * 60 * 1000,
  );
  if (now < windowOpensAt) return { action: "wait", reason: "window_not_open" };
  return { action: "place" };
}

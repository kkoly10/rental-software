/**
 * Marketplace booking state machine (spec §13) — pure and
 * deterministic, no I/O. The DB stores the state string; every
 * transition goes through `canTransition` so an illegal jump is a
 * programming error caught in code review and tests, not a data bug
 * discovered in a dispute.
 */

export const BOOKING_STATES = [
  "draft",
  "pending_verification",
  "pending_seller_approval",
  "awaiting_payment",
  "confirmed",
  "ready_for_handoff",
  "checked_out",
  "overdue",
  "returned_pending_review",
  "completed",
  "cancelled",
  "disputed",
] as const;

export type BookingState = (typeof BOOKING_STATES)[number];

/**
 * Allowed transitions. Notes:
 *  - request-to-book: draft → pending_seller_approval directly when the
 *    renter's verification level is already satisfied (§12 defers to
 *    the §6 matrix); pending_verification sits in between otherwise.
 *  - awaiting_payment exists only as the auto-capture FAILURE fallback
 *    (§10): approval normally captures the saved payment method and
 *    jumps straight to confirmed.
 *  - disputed can be entered from any post-checkout state; it resolves
 *    to completed (money allocation happens in the dispute domain).
 *  - cancelled is reachable from every pre-checkout state.
 */
const TRANSITIONS: Record<BookingState, readonly BookingState[]> = {
  draft: ["pending_verification", "pending_seller_approval", "cancelled"],
  pending_verification: ["pending_seller_approval", "cancelled"],
  pending_seller_approval: ["awaiting_payment", "confirmed", "cancelled"],
  awaiting_payment: ["confirmed", "cancelled"],
  confirmed: ["ready_for_handoff", "cancelled"],
  ready_for_handoff: ["checked_out", "cancelled"],
  checked_out: ["overdue", "returned_pending_review", "disputed"],
  overdue: ["returned_pending_review", "disputed"],
  returned_pending_review: ["completed", "disputed"],
  completed: [],
  cancelled: [],
  disputed: ["completed"],
};

export const TERMINAL_STATES: readonly BookingState[] = ["completed", "cancelled"];

export function isBookingState(value: string): value is BookingState {
  return (BOOKING_STATES as readonly string[]).includes(value);
}

export function canTransition(from: BookingState, to: BookingState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: BookingState, to: BookingState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal booking transition: ${from} → ${to}`);
  }
}

/** States that hold inventory (count against availability). */
export const INVENTORY_BLOCKING_STATES: readonly BookingState[] = [
  "confirmed",
  "ready_for_handoff",
  "checked_out",
  "overdue",
];

/**
 * §10: a request does NOT hard-hold inventory while awaiting the
 * seller — holds begin at approval. This predicate is what the
 * availability RPC mirrors in SQL; keep the two in sync.
 */
export function blocksInventory(state: BookingState): boolean {
  return INVENTORY_BLOCKING_STATES.includes(state);
}

// ── Turnaround buffers (§14) ─────────────────────────────────────────

export type EffectiveWindow = { effectiveStart: Date; effectiveEnd: Date };

export function computeEffectiveWindow(input: {
  startsAt: Date;
  endsAt: Date;
  prepBufferMinutes: number;
  recoveryBufferMinutes: number;
}): EffectiveWindow {
  const ms = 60_000;
  return {
    effectiveStart: new Date(input.startsAt.getTime() - input.prepBufferMinutes * ms),
    effectiveEnd: new Date(input.endsAt.getTime() + input.recoveryBufferMinutes * ms),
  };
}

export function windowsOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): boolean {
  return a.start < b.end && b.start < a.end;
}

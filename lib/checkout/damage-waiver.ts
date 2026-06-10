/**
 * PR-2c — damage waiver calculation.
 *
 * Pure helper so the checkout, the preview pricing card, and the
 * invoice PDF all agree on cents. The waiver applies to the rental
 * subtotal only (NOT delivery fee or tax): it's a cap-of-liability
 * for the rented goods, so it scales with what was rented.
 *
 * Rate stored in basis points (8.5% → 850 bps) on products so the
 * operator can tune it per-product (a $50 chair carries less risk
 * than a $5000 tent build). Null/0 → waiver not offered.
 */

export type WaiverComputation = {
  /** Customer-visible amount in dollars, rounded to the cent. */
  amount: number;
  /** Underlying basis points used. 0 when waiver doesn't apply. */
  rateBps: number;
};

export function computeDamageWaiver(params: {
  /** The taxable rental subtotal in dollars (before delivery / tax). */
  rentalSubtotal: number;
  /** Per-product rate in basis points; null/0/<= 0 → no waiver. */
  rateBps: number | null | undefined;
  /** Whether the customer accepted the waiver at checkout. */
  accepted: boolean;
}): WaiverComputation {
  if (!params.accepted) return { amount: 0, rateBps: 0 };
  const bps = params.rateBps ?? 0;
  if (bps <= 0 || params.rentalSubtotal <= 0) {
    return { amount: 0, rateBps: 0 };
  }
  const clampedBps = Math.min(5000, bps); // belt + suspenders for the DB constraint
  const cents = Math.round((params.rentalSubtotal * 100 * clampedBps) / 10_000);
  return { amount: cents / 100, rateBps: clampedBps };
}

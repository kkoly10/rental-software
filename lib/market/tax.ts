/**
 * Marketplace facilitator sales tax — DMV launch jurisdictions.
 *
 * Researched 2026-06-11 (sources in PR description):
 *  - DC: facilitator collection mandatory since 2019-04-01; general
 *    TPP/rental rate 6.0% through 2026-09-30, **7.0% from 2026-10-01**
 *    (already encoded below). Utility-trailer rentals are 10.25% in DC
 *    — relevant only if trailers-and-hauling ever goes live there.
 *  - MD: 6.0% statewide (single-rate state), rentals of tangible
 *    personal property are taxable sales; facilitator law applies.
 *  - VA: facilitator law (Code §58.1-612.1); Northern Virginia
 *    combined rate 6.0% (4.3% state + 1% local + 0.7% regional) —
 *    the DMV metro's VA side is all NoVA.
 *
 * The platform (facilitator) collects from the renter and remits;
 * tax is added to the renter's charge and EXCLUDED from the seller
 * payout. Tax keys off the seller's state (goods are picked
 * up/delivered locally within their service radius). Revisit when a
 * metro spans tax borders more aggressively than the DMV.
 */

export type DmvStateCode = "DC" | "MD" | "VA";

const DC_RATE_CHANGE = new Date("2026-10-01T00:00:00-04:00");

export function taxRateForState(state: string, on: Date = new Date()): number {
  switch (state) {
    case "DC":
      return on >= DC_RATE_CHANGE ? 0.07 : 0.06;
    case "MD":
      return 0.06;
    case "VA":
      return 0.06; // Northern Virginia combined rate
    default:
      // Unknown state: collect at the highest DMV rate rather than
      // under-collect; flagged for review via tax_state_code.
      return 0.06;
  }
}

/** Tax on the rental subtotal only — never on the refundable deposit. */
export function computeTaxCents(
  subtotalCents: number,
  state: string,
  on: Date = new Date(),
): number {
  if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) return 0;
  return Math.round(Math.trunc(subtotalCents) * taxRateForState(state, on));
}

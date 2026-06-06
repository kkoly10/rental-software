import type { Capability } from "../types.ts";

/**
 * Onsite-attendant capability — products declaring this come with an
 * included attendant for a fixed number of hours, with optional
 * overage billing for hours beyond that. Used by photo booths
 * (attendant typically included for the full rental) and concessions
 * (often 1 hour included, $100/hr after).
 *
 * Schema:
 *   - products.attendant_included_hours          integer
 *   - products.attendant_overage_cents_per_hour  integer
 *   - order_items.attendant_overage_hours        numeric(5,2)
 *
 * Pricing rule:
 *   overage_hours = max(0, rental_hours - included_hours)
 *   overage_cents = overage_hours × overage_rate_cents_per_hour
 *
 * Defensive: negative inputs clamp to 0; missing overage rate (null)
 * treated as no overage cost (operator chose to absorb the time).
 */

export type AttendantOverageInput = {
  /** Total hours the rental is on-site (active + idle). */
  rentalHours: number;
  /** Hours of attendant time included in the base price. */
  includedHours: number;
  /** Per-hour overage rate in cents. Null = no overage charge. */
  overageRateCentsPerHour: number | null;
};

export type AttendantOverageResult = {
  overageHours: number;
  overageCents: number;
};

export function computeAttendantOverage(
  input: AttendantOverageInput,
): AttendantOverageResult {
  const rental = Math.max(0, input.rentalHours);
  const included = Math.max(0, input.includedHours);
  const overageHours = Math.max(0, rental - included);
  const rate = Math.max(0, input.overageRateCentsPerHour ?? 0);
  return {
    overageHours,
    overageCents: Math.round(overageHours * rate),
  };
}

export const onsiteAttendant: Capability = {
  slug: "service.onsite-attendant",
  group: "service",
  i18nKey: "capabilities.service.onsiteAttendant",
};

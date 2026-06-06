import type { Capability } from "../types.ts";

/**
 * Per-hour pricing — used by photo booths, concessions, mechanical
 * bulls, food machines, and any future vertical billed by the hour
 * (audio/AV in particular).
 *
 * Pricing rule, in plain English:
 *
 *   billed_hours = max(requested_hours, minimum_hours ?? 0)
 *   line_total   = billed_hours * hourly_rate * quantity
 *
 * Defensive against:
 *   - Negative requested hours → clamped to 0 (which is then floored
 *     by the minimum, so a 0-hour rental with a 3-hour min bills
 *     3 hours).
 *   - Negative quantity → clamped to 0 (line total = 0, never refund
 *     the customer by accident).
 *   - Fractional hours preserved end-to-end (15-min increments via
 *     0.25 work).
 *
 * Idle-hour rate is in the schema for forward compatibility but not
 * used by this function yet — Phase 2+ checkout will get separate
 * active/idle inputs and a sibling helper will apply both rates.
 */

export type PerHourPriceInput = {
  hourlyRateCents: number;
  quantity: number;
  /** Hours the customer is requesting. May be fractional. */
  hours: number;
  /** Floor — billed hours never drop below this. Null = no floor. */
  minimumHours: number | null;
};

export type PerHourPriceResult = {
  lineTotalCents: number;
  billedHours: number;
  appliedMinimum: boolean;
};

export function computePerHourLineTotal(
  input: PerHourPriceInput,
): PerHourPriceResult {
  const requestedHours = Math.max(0, input.hours);
  const minHours = Math.max(0, input.minimumHours ?? 0);
  const billedHours = Math.max(requestedHours, minHours);
  const quantity = Math.max(0, input.quantity);
  const perUnitCents = Math.round(billedHours * input.hourlyRateCents);

  return {
    lineTotalCents: perUnitCents * quantity,
    billedHours,
    appliedMinimum: minHours > requestedHours,
  };
}

/**
 * Normalize a fractional-hour input (e.g. from a form field) to a
 * sensible billing increment. 15-minute increments (0.25 hours) are
 * the industry norm for photo booths and concessions.
 */
export function normalizeBilledHours(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.round(raw * 4) / 4; // round to nearest 0.25
}

export const perHourPricing: Capability = {
  slug: "pricing.per-hour",
  group: "pricing",
  i18nKey: "capabilities.pricing.perHour",
};

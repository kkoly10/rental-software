/**
 * Compute the number of rental days a multi-day booking spans, used to
 * multiply per_day base prices. Both bounds are inclusive: Mon→Fri = 5,
 * not 4. Returns 1 when only one date is supplied or when the inputs
 * are reversed/invalid (matches the "minimum one day" guard in the
 * checkout submit path).
 *
 * Extracted so the storefront summary, the checkout server action, and
 * any future surface that prices per-day all use the same math. The
 * previous setup had this inline in `lib/checkout/actions.ts:371-407`
 * and absent from `lib/data/checkout-pricing.ts` — so the review
 * summary undercharged when the customer entered a multi-day range and
 * the submit then billed correctly. Three-day, $300/day product →
 * summary $300, charged $900.
 */
export function computeRentalDays(
  eventDate: string | null | undefined,
  rentalEndDate: string | null | undefined
): number {
  if (!eventDate) return 1;
  if (!rentalEndDate || rentalEndDate < eventDate) return 1;
  // Both timestamps are UTC midnight of YYYY-MM-DD, so the diff is a
  // whole multiple of one day. +1 makes both endpoints count.
  const dayMs = 1000 * 60 * 60 * 24;
  const startMs = new Date(eventDate + "T00:00:00Z").getTime();
  const endMs = new Date(rentalEndDate + "T00:00:00Z").getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 1;
  const dayDiff = Math.round((endMs - startMs) / dayMs);
  return Math.max(1, dayDiff + 1);
}

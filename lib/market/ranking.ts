/**
 * Search/browse ranking v1 (spec §21) — pure and deterministic.
 *
 * Inputs are seller-level quality signals; price is deliberately NOT
 * an input ("do not rank purely by price"). The score is simple on
 * purpose: completions build trust slowly (capped), disputes cost
 * heavily, reviews carry the middle. Conversion/response-time inputs
 * join as the messaging metrics accumulate.
 */

export type SellerStats = {
  avgRating: number | null; // 1..5, null = no reviews yet
  reviewCount: number;
  completedBookings: number;
  disputes: number;
  /** Seller-fault cancellations incl. no-shows (decision 2026-06-11):
   *  renter is always made whole, the seller pays in ranking. */
  sellerCancellations: number;
};

export type Rankable = {
  organizationId: string;
  isPrelist: boolean;
  publishedAt?: string | null;
};

const NEUTRAL_RATING = 3.5; // cold-start sellers rank as "fine", not "bad"

export function sellerScore(stats: SellerStats | undefined): number {
  const rating = stats?.avgRating ?? NEUTRAL_RATING;
  const completions = Math.min(stats?.completedBookings ?? 0, 20);
  const disputes = stats?.disputes ?? 0;
  const sellerCancels = stats?.sellerCancellations ?? 0;
  // Rating dominates (2pts per star), completions add up to +2,
  // each dispute costs a full star equivalent, each seller-fault
  // cancellation costs three quarters of one.
  return rating * 2 + completions * 0.1 - disputes * 2 - sellerCancels * 1.5;
}

/**
 * Stable rank: quality desc, then newest listing first. Pre-listings
 * always sink below bookable inventory regardless of seller quality —
 * a browsable smoke-test world must never bury real supply.
 */
export function rankListings<T extends Rankable>(
  listings: readonly T[],
  statsByOrg: ReadonlyMap<string, SellerStats>,
): T[] {
  return [...listings].sort((a, b) => {
    if (a.isPrelist !== b.isPrelist) return a.isPrelist ? 1 : -1;
    const diff = sellerScore(statsByOrg.get(b.organizationId)) -
      sellerScore(statsByOrg.get(a.organizationId));
    if (diff !== 0) return diff;
    return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
  });
}

import type { Capability } from "../types.ts";

/**
 * Capacity-calculator capability — products declaring this surface
 * a guest-count input on the storefront PDP and return a sizing
 * recommendation. Used by tents (guests-per-tent-size) and dance
 * floors (sections-per-guest-count).
 *
 * Schema: products.capacity_metric ('guests' | 'sq_ft' | 'dancers' |
 * 'servings') + capacity_value integer.
 *
 * Phase 1c ships the dance-floor recommendation since that's the
 * industry-documented formula (Reventals + Imperial Party Rentals
 * 2026 guides agree: 30–50% of guests dance, ~4 sq ft per dancer,
 * a 3'×3' section is 9 sq ft). Tent guest-capacity is more
 * vendor-specific; that helper will land alongside the tent vertical
 * when its configuration lists what sizes it carries.
 */

export const CAPACITY_METRICS = ["guests", "sq_ft", "dancers", "servings"] as const;
export type CapacityMetric = typeof CAPACITY_METRICS[number];

export type DanceFloorRecommendation = {
  /** Sections sized for 30% of guests dancing — typical lower bound. */
  conservativeSections: number;
  /** Sections sized for 50% of guests dancing — typical upper bound. */
  generousSections: number;
};

/**
 * Recommend a dance-floor size (in 3'×3' sections) for a guest
 * count. Rounded UP — better to oversize than undersize for a
 * one-night event.
 */
export function recommendDanceFloorSections(guestCount: number): DanceFloorRecommendation {
  const guests = Math.max(0, Math.trunc(guestCount));
  const sqFtPerDancer = 4;
  const sqFtPerSection = 9; // 3'×3'
  return {
    conservativeSections: Math.ceil((guests * 0.3 * sqFtPerDancer) / sqFtPerSection),
    generousSections: Math.ceil((guests * 0.5 * sqFtPerDancer) / sqFtPerSection),
  };
}

export const capacityCalculator: Capability = {
  slug: "display.capacity-calculator",
  group: "display",
  i18nKey: "capabilities.display.capacityCalculator",
};

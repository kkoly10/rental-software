import type { Capability } from "../types.ts";

/**
 * Flat per-day pricing — the default rental pricing model used by
 * inflatables, tents, dance floors, and most party rentals.
 *
 * Behavior lives in lib/pricing/engine.ts and lib/pricing/rental-days.ts;
 * this capability is the registration point so verticals can declare
 * "I use flat-day pricing" without the dispatcher having to know which
 * concrete pricing module to call.
 *
 * Phase 0: capability is metadata only. Phase 1 (per-hour, per-unit)
 * adds peer pricing capabilities; the pricing engine will then look
 * up the active capability via product.capability_slugs and dispatch.
 */
export const flatDayPricing: Capability = {
  slug: "pricing.flat-day",
  group: "pricing",
  i18nKey: "capabilities.pricing.flatDay",
};

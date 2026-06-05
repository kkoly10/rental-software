import type { Capability } from "../types.ts";

/**
 * Anchoring setup capability — products declaring this expose the
 * anchoring-method multi-select + required-anchor-count fields in
 * the product form, and the chosen methods/count appear on the
 * crew pull sheet as a "Bring: stakes ×6" line.
 *
 * Used by inflatables today, will be used by tents in Phase 2 (the
 * anchoring methods stakes/sandbags/water_barrels/concrete_weights
 * map perfectly to tent staking).
 *
 * Behavior:
 *   - Pull-sheet formatter:   lib/inflatable/format-item-line.ts
 *   - Validation schema:      lib/validation/products.ts (anchoringMethodSchema)
 *   - DB columns:             products.anchoring_methods, required_anchor_count
 *
 * Phase 0: metadata only — existing callers keep importing the
 * underlying helpers from their current locations. Phase 1+ will
 * re-export here under capability-named aliases once the dispatcher
 * needs them.
 */
export const anchoringSetup: Capability = {
  slug: "setup.anchoring",
  group: "setup",
  i18nKey: "capabilities.setup.anchoring",
};

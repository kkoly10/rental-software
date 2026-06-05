import type { Capability } from "../types.ts";

/**
 * Surface-type capability — products declaring this expose the
 * grass / concrete / asphalt / other selector at checkout. Surface
 * type affects which anchoring methods are appropriate (stakes can't
 * go into concrete, water barrels can't go on grass without sinking,
 * etc.) so this is typically paired with the `setup.anchoring`
 * capability.
 *
 * Used by inflatables today, will be used by tents in Phase 2.
 *
 * Current validation is inline at lib/validation/orders.ts:12-16
 * (the values list is local-scoped, intentionally not exported).
 * Phase 0 declares the capability metadata only; Phase 1 will move
 * the schema into this module so non-inflatable verticals can opt in
 * without inheriting an inflatable-shaped validation path.
 */

export const SURFACE_TYPES = ["grass", "concrete", "asphalt", "other"] as const;
export type SurfaceType = typeof SURFACE_TYPES[number];

export const surfaceTypeSetup: Capability = {
  slug: "setup.surface-type",
  group: "setup",
  i18nKey: "capabilities.setup.surfaceType",
};

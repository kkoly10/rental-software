import type { Capability } from "../types.ts";

/**
 * Structured-specs capability — products declaring this surface a
 * specs table on the storefront PDP rendered from the product_specs
 * child table (one row per (key, label, value) entry).
 *
 * Used by every vertical for power requirements, dimensions,
 * capacities, included consumables, footprint, and any other
 * structured metadata that benefits from a definition-list layout
 * rather than free-text in the description.
 *
 * Schema: product_specs table (id, product_id, spec_key, spec_label,
 * spec_value, display_order, created_at).
 *
 * Phase 1c ships the type + sort helper. The Phase 2 product-form
 * will let operators add/edit rows; the storefront PDP renders.
 */

export type ProductSpec = {
  id: string;
  productId: string;
  /** Stable machine key, e.g. "power_requirement". Not displayed. */
  specKey: string;
  /** Localized human label, e.g. "Power". Shown on the PDP. */
  specLabel: string;
  /** Display value, e.g. "110V / 15A". */
  specValue: string;
  /** Sort order — ascending. */
  displayOrder: number;
};

/**
 * Sort specs by display_order ascending; rows with equal order are
 * preserved in input order (stable). Pure — does not mutate input.
 */
export function sortSpecsForDisplay(specs: readonly ProductSpec[]): ProductSpec[] {
  return [...specs].sort((a, b) => a.displayOrder - b.displayOrder);
}

export const structuredSpecs: Capability = {
  slug: "display.structured-specs",
  group: "display",
  i18nKey: "capabilities.display.structuredSpecs",
};

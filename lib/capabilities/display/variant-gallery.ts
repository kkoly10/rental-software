import type { Capability } from "../types.ts";

/**
 * Variant-gallery — products declaring this capability surface a
 * visual picker on the storefront PDP. Photo-booth backdrops, tent
 * color variants, dance-floor surface options (parquet / black /
 * white / LED).
 *
 * Each variant is a row in product_variants with its own label,
 * thumbnail, optional price delta, and an is_default flag (enforced
 * unique-per-product via a partial unique index in the migration).
 * The customer's selection lands on order_items.selected_variant_id.
 *
 * Phase 1d provides metadata + the sort/find/price-delta helpers.
 * Phase 2 wires the picker UI into the storefront PDP and threads
 * selected_variant_id through checkout.
 */

export type ProductVariant = {
  id: string;
  productId: string;
  variantLabel: string;
  thumbnailUrl: string | null;
  previewImageUrl: string | null;
  /** Can be negative (volume variant cheaper). Applied on top of base price. */
  priceDeltaCents: number;
  isDefault: boolean;
  displayOrder: number;
};

/** Sort variants by display_order ascending; stable. Pure. */
export function sortVariantsForDisplay(
  variants: readonly ProductVariant[],
): ProductVariant[] {
  return [...variants].sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Find the default variant. Returns undefined if no variant is
 * flagged as default (the storefront should fall back to the first
 * row in display order — see resolveInitialVariant).
 */
export function findDefaultVariant(
  variants: readonly ProductVariant[],
): ProductVariant | undefined {
  return variants.find((v) => v.isDefault);
}

/**
 * Resolve what the storefront PDP should show selected on initial
 * render: the default variant if one exists, else the first variant
 * by display order. Returns undefined only when the variant list
 * is empty.
 */
export function resolveInitialVariant(
  variants: readonly ProductVariant[],
): ProductVariant | undefined {
  if (variants.length === 0) return undefined;
  const defaulted = findDefaultVariant(variants);
  if (defaulted) return defaulted;
  const sorted = sortVariantsForDisplay(variants);
  return sorted[0];
}

/**
 * Compute the effective per-unit price for a base + variant pair.
 * Defensive against negative base prices (clamped to 0) and clamps
 * the final result to ≥ 0 so a deeply negative price_delta can't
 * roll over into a negative charge.
 */
export function applyVariantPriceDelta(
  basePriceCents: number,
  variant: ProductVariant | undefined,
): number {
  const base = Math.max(0, basePriceCents);
  const delta = variant?.priceDeltaCents ?? 0;
  return Math.max(0, base + delta);
}

export const variantGallery: Capability = {
  slug: "display.variant-gallery",
  group: "display",
  i18nKey: "capabilities.display.variantGallery",
};

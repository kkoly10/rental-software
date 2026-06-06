import type { Capability } from "../types.ts";

/**
 * Add-ons composition — products declaring this capability can be
 * sold with checkbox-style accessory products. Tent + sidewalls +
 * lighting. Photo booth + extra hours. Concession + cleaning fee.
 * Tables/chairs + setup service.
 *
 * Each add-on is itself a product row (with its own price + capability
 * slugs), linked to its parent via the product_addons join table.
 * That means an add-on's pricing dispatches through its own pricing
 * capability — sidewalls bill flat-day, extra photo-booth hours bill
 * per-hour. The dispatcher (Phase 2) glues this together; the helpers
 * here just validate customer selection against the available rows.
 *
 * Schema (supabase/migrations/20260608_100000_product_addons.sql):
 *   product_addons(parent_product_id, addon_product_id,
 *                  default_quantity, max_quantity, is_required,
 *                  display_order)
 * Plus order_items.parent_order_item_id self-FK so add-on line items
 * can trace back to the parent (migration 20260608_120000).
 */

export type ProductAddonRow = {
  id: string;
  parentProductId: string;
  addonProductId: string;
  /** Quantity the storefront pre-fills. Required add-ons enforce this as a floor. */
  defaultQuantity: number;
  /** Hard cap; null = no cap. */
  maxQuantity: number | null;
  /** Required add-ons must appear in a valid selection with qty ≥ defaultQuantity. */
  isRequired: boolean;
  /** Sort order ascending. */
  displayOrder: number;
};

export type AddonSelection = {
  addonProductId: string;
  /** Truncated to integer; clamped to ≥ 0 during validation. */
  quantity: number;
};

export type AddonValidationError =
  | { addonProductId: string; reason: "required_missing"; required: number }
  | { addonProductId: string; reason: "below_required_default"; selected: number; required: number }
  | { addonProductId: string; reason: "exceeds_max"; selected: number; max: number };

export type AddonValidationResult = {
  ok: boolean;
  errors: AddonValidationError[];
  /** Cleaned list, ready to write to order_items. Excludes unknown
   *  add-ons (selections that don't match any available row) and
   *  zeros out negative qty. */
  normalizedSelections: AddonSelection[];
};

/**
 * Validate customer add-on selections against the parent product's
 * available rows.
 *
 *   - Required add-ons must appear with qty ≥ defaultQuantity
 *   - Optional add-ons may appear with qty in [0, maxQuantity]
 *   - Selections referencing unknown addonProductId are dropped from
 *     normalized output (no error — the storefront UI is the source
 *     of truth for what's offered)
 *   - Negative qty truncated to 0 silently (never refund through a
 *     sign flip); fractional qty truncated toward zero (DB enforces
 *     integer)
 */
export function validateAddonSelections(
  available: readonly ProductAddonRow[],
  selections: readonly AddonSelection[],
): AddonValidationResult {
  const availableByAddonId = new Map(
    available.map((a) => [a.addonProductId, a] as const),
  );

  const selectedByAddonId = new Map<string, number>();
  for (const s of selections) {
    const qty = Math.max(0, Math.trunc(s.quantity));
    if (availableByAddonId.has(s.addonProductId)) {
      // Coalesce duplicate selections for the same addon (last write wins).
      selectedByAddonId.set(s.addonProductId, qty);
    }
  }

  const errors: AddonValidationError[] = [];
  for (const a of available) {
    const selected = selectedByAddonId.get(a.addonProductId);

    if (a.isRequired) {
      if (selected === undefined || selected === 0) {
        errors.push({
          addonProductId: a.addonProductId,
          reason: "required_missing",
          required: a.defaultQuantity,
        });
        continue;
      }
      if (selected < a.defaultQuantity) {
        errors.push({
          addonProductId: a.addonProductId,
          reason: "below_required_default",
          selected,
          required: a.defaultQuantity,
        });
      }
    }

    if (selected !== undefined && a.maxQuantity != null && selected > a.maxQuantity) {
      errors.push({
        addonProductId: a.addonProductId,
        reason: "exceeds_max",
        selected,
        max: a.maxQuantity,
      });
    }
  }

  const normalizedSelections: AddonSelection[] = [];
  for (const [addonProductId, quantity] of selectedByAddonId) {
    if (quantity > 0) {
      normalizedSelections.push({ addonProductId, quantity });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    normalizedSelections,
  };
}

/** Sort add-ons by display_order ascending; stable. Pure. */
export function sortAddonsForDisplay(
  addons: readonly ProductAddonRow[],
): ProductAddonRow[] {
  return [...addons].sort((a, b) => a.displayOrder - b.displayOrder);
}

export const addOnsComposition: Capability = {
  slug: "composition.add-ons",
  group: "composition",
  i18nKey: "capabilities.composition.addOns",
};

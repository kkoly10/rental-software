import type { Capability } from "../types.ts";

/**
 * Minimum-order capability — used by tables & chairs (commonly $600
 * order minimum, or 50-chair minimum-quantity per product). Comes in
 * two flavors that can be combined:
 *
 *   1. Category-level dollar minimum (e.g. tables/chairs delivery
 *      doesn't make economic sense below $600) — categories.minimum_order_cents
 *   2. Product-level quantity minimum (e.g. chiavari chairs sold in
 *      packs of 50 minimum) — products.minimum_order_quantity
 *
 * Both enforced at checkout, surfaced as a friendly "add $X more" or
 * "minimum 50 chairs" message rather than a hard error.
 */

export type EnforceOrderMinResult = {
  ok: boolean;
  shortByCents: number;
};

export function enforceOrderMinimum(
  orderTotalCents: number,
  minimumCents: number | null,
): EnforceOrderMinResult {
  const total = Math.max(0, orderTotalCents);
  const min = Math.max(0, minimumCents ?? 0);
  if (total >= min) return { ok: true, shortByCents: 0 };
  return { ok: false, shortByCents: min - total };
}

export type EnforceMinQuantityResult = {
  ok: boolean;
  shortByUnits: number;
};

export function enforceProductMinQuantity(
  units: number,
  minQuantity: number | null,
): EnforceMinQuantityResult {
  const u = Math.max(0, Math.trunc(units));
  const min = Math.max(0, minQuantity ?? 0);
  if (u >= min) return { ok: true, shortByUnits: 0 };
  return { ok: false, shortByUnits: min - u };
}

export const minimumOrder: Capability = {
  slug: "order.minimum-order",
  group: "order",
  i18nKey: "capabilities.order.minimumOrder",
};

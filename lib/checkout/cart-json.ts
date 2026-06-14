/**
 * Phase 3b — multi-item cart submit.
 *
 * Parsing + validation of the `cart_json` form field that the multi-item
 * checkout flow POSTs to `createCheckoutOrder`. The cart is a JSON array
 * of per-item selections that mirror the single-product form fields
 * (slug, mode, units, variantId, addons) so each entry can be handed
 * straight to `priceAndResolveOneItem` — the server re-derives ALL money;
 * the cart carries NO prices the server trusts.
 *
 * This module is intentionally pure (no DB, no Supabase) so it can be
 * unit-tested in isolation and so the action's hot path stays readable.
 */

/** Max items a single cart submit may contain. A combined party booking
 *  of more than this is almost certainly malformed/abusive input; cap it
 *  defensively so a crafted POST can't fan out into hundreds of pricing +
 *  availability round-trips. */
export const MAX_CART_ITEMS = 25;

/** One resolved-and-validated cart line, in the exact shape
 *  `priceAndResolveOneItem` reads (minus the order-level event fields,
 *  which the action supplies once). */
export type ParsedCartItem = {
  productSlug: string;
  requestedMode: "dry" | "wet" | null;
  requestedUnits: number;
  requestedVariantId: string | null;
  requestedAddons: { addonProductId: string; quantity: number }[];
};

export type ParseCartJsonResult =
  | { ok: true; items: ParsedCartItem[] }
  | { ok: false; message: string };

const UUID_RE = /^[0-9a-f-]{36}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/**
 * Parse + validate the raw `cart_json` string. Mirrors the defensive
 * parsing the single-item path applies to its individual form fields:
 *  - units: integers only, anything else → 1 (the per-unit helper clamps
 *    + truncates again downstream, so this is belt-and-suspenders).
 *  - variantId: UUID-shaped only, else null (product-scoped lookup is the
 *    real security gate).
 *  - addons: UUID id + positive integer qty only; unknown/zero entries
 *    dropped (product-scoped lookup is the real security gate).
 *
 * Rejects: non-JSON, non-array, empty array, more than MAX_CART_ITEMS, or
 * an entry with no usable slug.
 */
export function parseCartJson(raw: string | null | undefined): ParseCartJsonResult {
  if (!raw || raw.trim() === "") {
    return { ok: false, message: "Your cart is empty. Add an item before checking out." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "We couldn't read your cart. Please reopen your cart and try again." };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, message: "We couldn't read your cart. Please reopen your cart and try again." };
  }

  if (parsed.length === 0) {
    return { ok: false, message: "Your cart is empty. Add an item before checking out." };
  }

  if (parsed.length > MAX_CART_ITEMS) {
    return {
      ok: false,
      message: `A single checkout can include at most ${MAX_CART_ITEMS} items. Please remove some and try again.`,
    };
  }

  const items: ParsedCartItem[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, message: "One of your cart items is invalid. Please reopen your cart and try again." };
    }
    const e = entry as Record<string, unknown>;

    const slug = typeof e.slug === "string" ? e.slug.trim() : "";
    if (!slug || !SLUG_RE.test(slug)) {
      return { ok: false, message: "One of your cart items is invalid. Please reopen your cart and try again." };
    }

    const requestedMode: "dry" | "wet" | null =
      e.mode === "dry" || e.mode === "wet" ? e.mode : null;

    // Integers only; clamp non-integers / non-positives to 1. The per-unit
    // pricing helper truncates + clamps again downstream.
    const requestedUnits =
      typeof e.units === "number" && Number.isInteger(e.units) && e.units > 0
        ? e.units
        : 1;

    const requestedVariantId =
      typeof e.variantId === "string" && UUID_RE.test(e.variantId) ? e.variantId : null;

    const requestedAddons: { addonProductId: string; quantity: number }[] = [];
    if (Array.isArray(e.addons)) {
      for (const a of e.addons) {
        if (!a || typeof a !== "object") continue;
        const ao = a as Record<string, unknown>;
        const id = typeof ao.id === "string" ? ao.id : "";
        const qtyRaw = ao.qty;
        const qty =
          typeof qtyRaw === "number" && Number.isInteger(qtyRaw) && qtyRaw > 0
            ? qtyRaw
            : 0;
        if (!UUID_RE.test(id) || qty <= 0) continue;
        requestedAddons.push({ addonProductId: id, quantity: qty });
      }
    }

    items.push({ productSlug: slug, requestedMode, requestedUnits, requestedVariantId, requestedAddons });
  }

  return { ok: true, items };
}

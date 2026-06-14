/**
 * Phase 3a — characterization tests for priceAndResolveOneItem.
 *
 * These PIN the behavior of the per-item pricing / resolution helper
 * extracted from createCheckoutOrder (lib/checkout/actions.ts). They are
 * deliberately characterization tests: they assert the helper produces
 * the SAME numeric outputs and validation shapes the inline block did,
 * so a future refactor (or the multi-item cart in Phase 3b) can't drift.
 *
 * The Supabase client is a minimal hand-rolled stub: every `.from(table)`
 * returns a chainable query builder whose terminal (`maybeSingle()` /
 * being awaited directly) yields a canned `{ data }` per table. The chain
 * mirrors exactly what the helper calls:
 *   products       → .select().eq().eq().eq().eq().is().maybeSingle()
 *   organizations  → .select().eq().is().maybeSingle()   (per_day only)
 *   product_addons → .select().eq()  (awaited directly, no maybeSingle)
 *   product_variants → .select().eq().eq().maybeSingle()
 */
import test from "node:test";
import assert from "node:assert/strict";
import { priceAndResolveOneItem } from "../lib/checkout/pricing-helpers.ts";

const ORG = "11111111-1111-1111-1111-111111111111";

type CannedRows = {
  products?: unknown;
  organizations?: unknown;
  product_addons?: unknown;
  product_variants?: unknown;
};

/**
 * Build a fake Supabase client. `rows` provides the `data` each table's
 * query resolves to. The returned builder is both chainable AND a
 * thenable, so it works whether the helper ends the chain with
 * `.maybeSingle()` or awaits the builder directly (product_addons).
 */
function makeSupabase(rows: CannedRows) {
  return {
    from(table: string) {
      const result = { data: rows[table as keyof CannedRows] ?? null, error: null };
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        maybeSingle: async () => result,
        single: async () => result,
        // Awaiting the builder directly (the product_addons path) resolves
        // to the canned { data, error }.
        then: (resolve: (v: typeof result) => unknown) => resolve(result),
      };
      return builder;
    },
  };
}

const baseRequest = {
  productSlug: "widget",
  requestedMode: null as "dry" | "wet" | null,
  requestedUnits: 1,
  requestedVariantId: null as string | null,
  requestedAddons: [] as { addonProductId: string; quantity: number }[],
  eventDate: undefined as string | undefined,
  rentalEndDate: undefined as string | undefined,
  startTime: undefined as string | undefined,
  endTime: undefined as string | undefined,
  waiverAccepted: false,
};

test("product not found → zero-priced defaults, ok:true", async () => {
  const supabase = makeSupabase({ products: null });
  const result = await priceAndResolveOneItem(supabase, ORG, { ...baseRequest });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.subtotal, 0);
  assert.equal(result.productId, null);
  assert.equal(result.productName, "Rental booking");
});

test("missing price (no base_price, not per-unit) → ok:false with the exact gate message", async () => {
  const supabase = makeSupabase({
    products: {
      id: "p1",
      name: "Quote-only tent",
      base_price: null,
      pricing_model: "flat_day",
      capability_slugs: [],
    },
  });
  const result = await priceAndResolveOneItem(supabase, ORG, { ...baseRequest });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(
    result.message,
    "Pricing isn't set for this item yet. Please contact us to confirm a quote before booking.",
  );
  assert.equal(result.logEvent.action, "missing_price_blocked");
  assert.equal(result.logEvent.status, "warning");
  assert.deepEqual(result.logEvent.metadata, {
    product_slug: "widget",
    product_id: "p1",
  });
});

test("per-day flat product (single day) bills base_price once", async () => {
  const supabase = makeSupabase({
    products: {
      id: "p1",
      name: "Bounce house",
      base_price: 225,
      pricing_model: "flat_day",
      capability_slugs: [],
    },
  });
  const result = await priceAndResolveOneItem(supabase, ORG, { ...baseRequest });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.subtotal, 225);
  assert.equal(result.productId, "p1");
  assert.equal(result.productName, "Bounce house");
  // flat path leaves the per-day audit fields null
  assert.equal(result.itemRentalDays, null);
  assert.equal(result.itemRatePerDay, null);
});

test("per_day pricing model over a 3-day range bills rate × days", async () => {
  const supabase = makeSupabase({
    products: {
      id: "p1",
      name: "Tent",
      base_price: 300,
      pricing_model: "per_day",
      capability_slugs: [],
    },
    organizations: { settings: {} }, // no pricing_rules → no adjustments
  });
  const result = await priceAndResolveOneItem(supabase, ORG, {
    ...baseRequest,
    eventDate: "2026-07-01",
    rentalEndDate: "2026-07-03", // inclusive → 3 days
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.subtotal, 900); // 300 × 3
  assert.equal(result.itemRentalDays, 3);
  assert.equal(result.itemRatePerDay, 300);
});

test("per-unit product at the requested count bills units × unit_price", async () => {
  const supabase = makeSupabase({
    products: {
      id: "p1",
      name: "Chairs",
      base_price: null, // priced via unit_price_cents
      pricing_model: "flat_day",
      capability_slugs: ["pricing.per-unit"],
      unit_price_cents: 500, // $5/chair
    },
  });
  const result = await priceAndResolveOneItem(supabase, ORG, {
    ...baseRequest,
    requestedUnits: 100,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.subtotal, 500); // 100 × $5
  assert.equal(result.billedUnitsForLineItem, 100);
});

test("per-unit product surfaces minimum-order capability state for the caller's gate", async () => {
  // The min-quantity gate itself lives in the action; the helper's job is
  // to surface productMinimumOrderQuantity + billedUnits so the caller can
  // run enforceProductMinQuantity. Pin those outputs at and below minimum.
  const productRow = {
    id: "p1",
    name: "Chairs",
    base_price: null,
    pricing_model: "flat_day",
    capability_slugs: ["pricing.per-unit", "order.minimum-order"],
    unit_price_cents: 500,
    minimum_order_quantity: 50,
    categories: { minimum_order_cents: 60000, vertical: "tables-chairs" },
  };

  // At the minimum
  const atMin = await priceAndResolveOneItem(makeSupabase({ products: productRow }), ORG, {
    ...baseRequest,
    requestedUnits: 50,
  });
  assert.equal(atMin.ok, true);
  if (!atMin.ok) return;
  assert.equal(atMin.orderMinimumCapabilityActive, true);
  assert.equal(atMin.productMinimumOrderQuantity, 50);
  assert.equal(atMin.productMinimumOrderCents, 60000);
  assert.equal(atMin.billedUnitsForLineItem, 50); // caller: 50 >= 50 → ok

  // Below the minimum — helper still prices; caller's gate rejects.
  const belowMin = await priceAndResolveOneItem(makeSupabase({ products: productRow }), ORG, {
    ...baseRequest,
    requestedUnits: 10,
  });
  assert.equal(belowMin.ok, true);
  if (!belowMin.ok) return;
  assert.equal(belowMin.billedUnitsForLineItem, 10); // caller: 10 < 50 → below-min
  assert.equal(belowMin.subtotal, 50); // 10 × $5
});

test("per-hour product applies the minimum-hours floor", async () => {
  const supabase = makeSupabase({
    products: {
      id: "p1",
      name: "Photo booth",
      base_price: 1, // satisfies the price gate; per-hour path overrides subtotal
      pricing_model: "flat_day",
      capability_slugs: ["pricing.per-hour"],
      hourly_rate_cents: 10000, // $100/hr
      minimum_hours: 3,
    },
  });
  // Customer requests 2h (10:00–12:00) but the 3h floor applies.
  const result = await priceAndResolveOneItem(supabase, ORG, {
    ...baseRequest,
    startTime: "10:00",
    endTime: "12:00",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.subtotal, 300); // 3h floor × $100
  assert.equal(result.billedHoursForLineItem, 3);
});

test("wet upcharge is added once on a mode-aware product", async () => {
  const supabase = makeSupabase({
    products: {
      id: "p1",
      name: "Water slide",
      base_price: 400,
      pricing_model: "flat_day",
      capability_slugs: [],
      supports_modes: ["dry", "wet"],
      wet_upcharge_cents: 5000, // $50
    },
  });
  const result = await priceAndResolveOneItem(supabase, ORG, {
    ...baseRequest,
    requestedMode: "wet",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.effectiveMode, "wet");
  assert.equal(result.wetUpchargeApplied, 50);
  assert.equal(result.subtotal, 450); // 400 + 50, added once
});

test("crafted wet mode on a dry-only product does NOT bill the upcharge", async () => {
  const supabase = makeSupabase({
    products: {
      id: "p1",
      name: "Dry bouncer",
      base_price: 400,
      pricing_model: "flat_day",
      capability_slugs: [],
      supports_modes: ["dry"],
      wet_upcharge_cents: 5000,
    },
  });
  const result = await priceAndResolveOneItem(supabase, ORG, {
    ...baseRequest,
    requestedMode: "wet",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.effectiveMode, null);
  assert.equal(result.wetUpchargeApplied, 0);
  assert.equal(result.subtotal, 400);
});

test("variant price delta is added to the post-pricing subtotal", async () => {
  const variantId = "22222222-2222-2222-2222-222222222222";
  const supabase = makeSupabase({
    products: {
      id: "p1",
      name: "Linen",
      base_price: 100,
      pricing_model: "flat_day",
      capability_slugs: [],
    },
    product_variants: { id: variantId, price_delta_cents: 2500 }, // +$25
  });
  const result = await priceAndResolveOneItem(supabase, ORG, {
    ...baseRequest,
    requestedVariantId: variantId,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.resolvedVariantId, variantId);
  assert.equal(result.variantPriceDeltaCents, 2500);
  assert.equal(result.subtotal, 125); // 100 + 25
});

test("one add-on resolves into a line and rolls into the subtotal", async () => {
  const addonId = "33333333-3333-3333-3333-333333333333";
  const supabase = makeSupabase({
    products: {
      id: "p1",
      name: "Table package",
      base_price: 200,
      pricing_model: "flat_day",
      capability_slugs: ["composition.add-ons"],
    },
    product_addons: [
      {
        addon_product_id: addonId,
        max_quantity: 10,
        addon: { id: addonId, name: "Chair", base_price: 5 }, // $5
      },
    ],
  });
  const result = await priceAndResolveOneItem(supabase, ORG, {
    ...baseRequest,
    requestedAddons: [{ addonProductId: addonId, quantity: 4 }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.resolvedAddonLines.length, 1);
  const line = result.resolvedAddonLines[0];
  assert.equal(line.addonProductId, addonId);
  assert.equal(line.name, "Chair");
  assert.equal(line.basePriceCents, 500);
  assert.equal(line.quantity, 4);
  assert.equal(line.lineTotalCents, 2000); // 4 × $5
  assert.equal(result.subtotal, 220); // 200 + $20
});

test("add-on quantity is clamped to max_quantity", async () => {
  const addonId = "44444444-4444-4444-4444-444444444444";
  const supabase = makeSupabase({
    products: {
      id: "p1",
      name: "Table package",
      base_price: 200,
      pricing_model: "flat_day",
      capability_slugs: ["composition.add-ons"],
    },
    product_addons: [
      {
        addon_product_id: addonId,
        max_quantity: 2,
        addon: { id: addonId, name: "Chair", base_price: 5 },
      },
    ],
  });
  const result = await priceAndResolveOneItem(supabase, ORG, {
    ...baseRequest,
    requestedAddons: [{ addonProductId: addonId, quantity: 99 }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.resolvedAddonLines[0].quantity, 2); // clamped
  assert.equal(result.subtotal, 210); // 200 + 2 × $5
});

test("damage waiver, when accepted, adds a rate-bps surcharge on the rental subtotal", async () => {
  const supabase = makeSupabase({
    products: {
      id: "p1",
      name: "Tent",
      base_price: 1000,
      pricing_model: "flat_day",
      capability_slugs: [],
      damage_waiver_rate_bps: 850, // 8.5%
    },
  });
  const result = await priceAndResolveOneItem(supabase, ORG, {
    ...baseRequest,
    waiverAccepted: true,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.waiver.rateBps, 850);
  assert.equal(result.waiver.amount, 85); // 8.5% of $1000
  assert.equal(result.subtotal, 1085);
});

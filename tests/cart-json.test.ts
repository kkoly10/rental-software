/**
 * Phase 3b — unit tests for parseCartJson (lib/checkout/cart-json.ts).
 *
 * The multi-item submit path is money code, so the cart parser is the
 * first gate: it rejects empty / malformed / over-cap carts BEFORE any
 * pricing or DB work, and normalizes per-item selections into the exact
 * shape priceAndResolveOneItem reads. These tests pin that contract.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseCartJson, MAX_CART_ITEMS } from "../lib/checkout/cart-json.ts";

const UUID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const UUID2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

test("rejects null / empty string", () => {
  assert.equal(parseCartJson(null).ok, false);
  assert.equal(parseCartJson("").ok, false);
  assert.equal(parseCartJson("   ").ok, false);
});

test("rejects non-JSON", () => {
  const r = parseCartJson("{not json");
  assert.equal(r.ok, false);
});

test("rejects a non-array payload", () => {
  const r = parseCartJson(JSON.stringify({ slug: "x" }));
  assert.equal(r.ok, false);
});

test("rejects an empty array", () => {
  const r = parseCartJson(JSON.stringify([]));
  assert.equal(r.ok, false);
});

test("rejects more than MAX_CART_ITEMS", () => {
  const many = Array.from({ length: MAX_CART_ITEMS + 1 }, () => ({ slug: "bounce-house" }));
  const r = parseCartJson(JSON.stringify(many));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, new RegExp(String(MAX_CART_ITEMS)));
});

test("accepts exactly MAX_CART_ITEMS", () => {
  const many = Array.from({ length: MAX_CART_ITEMS }, () => ({ slug: "bounce-house" }));
  const r = parseCartJson(JSON.stringify(many));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.items.length, MAX_CART_ITEMS);
});

test("rejects an item with a missing / malformed slug", () => {
  assert.equal(parseCartJson(JSON.stringify([{ slug: "" }])).ok, false);
  assert.equal(parseCartJson(JSON.stringify([{ slug: "has space" }])).ok, false);
  assert.equal(parseCartJson(JSON.stringify([{ notSlug: "x" }])).ok, false);
  assert.equal(parseCartJson(JSON.stringify([42])).ok, false);
});

test("defaults: minimal valid item", () => {
  const r = parseCartJson(JSON.stringify([{ slug: "bounce-house" }]));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.items[0], {
    productSlug: "bounce-house",
    requestedMode: null,
    requestedUnits: 1,
    requestedVariantId: null,
    requestedAddons: [],
  });
});

test("trims slug whitespace", () => {
  const r = parseCartJson(JSON.stringify([{ slug: "  bounce-house  " }]));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.items[0].productSlug, "bounce-house");
});

test("normalizes mode (only dry/wet survive)", () => {
  const r = parseCartJson(
    JSON.stringify([
      { slug: "a", mode: "dry" },
      { slug: "b", mode: "wet" },
      { slug: "c", mode: "soggy" },
    ]),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.items[0].requestedMode, "dry");
  assert.equal(r.items[1].requestedMode, "wet");
  assert.equal(r.items[2].requestedMode, null);
});

test("clamps units to 1 unless a positive integer", () => {
  const cases: [unknown, number][] = [
    [5, 5],
    [0, 1],
    [-3, 1],
    [2.7, 1],
    ["8", 1],
  ];
  for (const [units, expected] of cases) {
    const r = parseCartJson(JSON.stringify([{ slug: "chairs", units }]));
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.items[0].requestedUnits, expected, `units=${JSON.stringify(units)}`);
  }
});

test("variantId accepted only when UUID-shaped", () => {
  const ok = parseCartJson(JSON.stringify([{ slug: "a", variantId: UUID }]));
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.items[0].requestedVariantId, UUID);

  const bad = parseCartJson(JSON.stringify([{ slug: "a", variantId: "nope" }]));
  assert.equal(bad.ok, true);
  if (bad.ok) assert.equal(bad.items[0].requestedVariantId, null);
});

test("addons: keeps valid UUID+positive-int entries, drops the rest", () => {
  const r = parseCartJson(
    JSON.stringify([
      {
        slug: "a",
        addons: [
          { id: UUID, qty: 2 },
          { id: UUID2, qty: 0 }, // qty 0 dropped
          { id: "bad", qty: 3 }, // bad id dropped
          { id: UUID2, qty: 1.5 }, // fractional dropped
          { id: UUID2, qty: 4 },
        ],
      },
    ]),
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.items[0].requestedAddons, [
    { addonProductId: UUID, quantity: 2 },
    { addonProductId: UUID2, quantity: 4 },
  ]);
});

test("ignores non-array addons gracefully", () => {
  const r = parseCartJson(JSON.stringify([{ slug: "a", addons: "x" }]));
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.items[0].requestedAddons, []);
});

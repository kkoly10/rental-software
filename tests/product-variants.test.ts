/**
 * Phase 1d — display.variant-gallery capability.
 *
 * Pure helpers: sort by display_order, find default, resolve the
 * initial selection (default → first-in-order → undefined), apply
 * price delta with non-negative clamping.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  sortVariantsForDisplay,
  findDefaultVariant,
  resolveInitialVariant,
  applyVariantPriceDelta,
  type ProductVariant,
} from "../lib/capabilities/display/variant-gallery.ts";

const makeVariant = (overrides: Partial<ProductVariant> & { id: string }): ProductVariant => ({
  productId: "p-photo-booth",
  variantLabel: `Backdrop ${overrides.id}`,
  thumbnailUrl: null,
  previewImageUrl: null,
  priceDeltaCents: 0,
  isDefault: false,
  displayOrder: 0,
  ...overrides,
});

// ─── sortVariantsForDisplay ────────────────────────────────────────

test("sorts by displayOrder ascending", () => {
  const sorted = sortVariantsForDisplay([
    makeVariant({ id: "c", displayOrder: 30 }),
    makeVariant({ id: "a", displayOrder: 10 }),
    makeVariant({ id: "b", displayOrder: 20 }),
  ]);
  assert.deepEqual(sorted.map((v) => v.id), ["a", "b", "c"]);
});

test("equal displayOrder preserves input order (stable)", () => {
  const sorted = sortVariantsForDisplay([
    makeVariant({ id: "x", displayOrder: 5 }),
    makeVariant({ id: "y", displayOrder: 5 }),
    makeVariant({ id: "z", displayOrder: 5 }),
  ]);
  assert.deepEqual(sorted.map((v) => v.id), ["x", "y", "z"]);
});

test("does not mutate input", () => {
  const input = [
    makeVariant({ id: "b", displayOrder: 20 }),
    makeVariant({ id: "a", displayOrder: 10 }),
  ];
  const snap = [...input];
  sortVariantsForDisplay(input);
  assert.deepEqual(input, snap);
});

// ─── findDefaultVariant ───────────────────────────────────────────

test("findDefaultVariant returns the row flagged is_default", () => {
  const found = findDefaultVariant([
    makeVariant({ id: "a", isDefault: false }),
    makeVariant({ id: "b", isDefault: true }),
    makeVariant({ id: "c", isDefault: false }),
  ]);
  assert.equal(found?.id, "b");
});

test("findDefaultVariant returns undefined when none is flagged", () => {
  const found = findDefaultVariant([
    makeVariant({ id: "a" }),
    makeVariant({ id: "b" }),
  ]);
  assert.equal(found, undefined);
});

test("findDefaultVariant on empty list → undefined", () => {
  assert.equal(findDefaultVariant([]), undefined);
});

// ─── resolveInitialVariant ────────────────────────────────────────

test("resolveInitialVariant prefers the default", () => {
  const found = resolveInitialVariant([
    makeVariant({ id: "a", displayOrder: 1 }),
    makeVariant({ id: "b", isDefault: true, displayOrder: 99 }),
  ]);
  assert.equal(found?.id, "b");
});

test("resolveInitialVariant falls back to first-by-order when no default", () => {
  const found = resolveInitialVariant([
    makeVariant({ id: "c", displayOrder: 30 }),
    makeVariant({ id: "a", displayOrder: 10 }),
    makeVariant({ id: "b", displayOrder: 20 }),
  ]);
  assert.equal(found?.id, "a");
});

test("resolveInitialVariant returns undefined on empty list", () => {
  assert.equal(resolveInitialVariant([]), undefined);
});

// ─── applyVariantPriceDelta ───────────────────────────────────────

test("undefined variant → base unchanged", () => {
  assert.equal(applyVariantPriceDelta(10000, undefined), 10000);
});

test("zero delta → base unchanged", () => {
  const v = makeVariant({ id: "a", priceDeltaCents: 0 });
  assert.equal(applyVariantPriceDelta(10000, v), 10000);
});

test("positive delta adds", () => {
  const v = makeVariant({ id: "a", priceDeltaCents: 2500 });
  assert.equal(applyVariantPriceDelta(10000, v), 12500);
});

test("negative delta subtracts", () => {
  const v = makeVariant({ id: "a", priceDeltaCents: -2500 });
  assert.equal(applyVariantPriceDelta(10000, v), 7500);
});

test("negative delta exceeding base clamps to 0 (never negative charge)", () => {
  const v = makeVariant({ id: "a", priceDeltaCents: -50000 });
  assert.equal(applyVariantPriceDelta(10000, v), 0);
});

test("negative base clamps to 0 first", () => {
  const v = makeVariant({ id: "a", priceDeltaCents: 500 });
  assert.equal(applyVariantPriceDelta(-1000, v), 500);
});

test("realistic photo-booth: premium sequin backdrop adds $25", () => {
  const v = makeVariant({
    id: "sequin-gold",
    variantLabel: "Sequin Gold",
    priceDeltaCents: 2500,
  });
  assert.equal(applyVariantPriceDelta(50000, v), 52500); // $500 + $25
});

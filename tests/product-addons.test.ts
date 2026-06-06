/**
 * Phase 1d — composition.add-ons capability.
 *
 * Validates customer selections against the available add-ons.
 * Required add-ons must be selected ≥ default; optional may be 0..max.
 * Negative qty clamped, fractional truncated, unknown add-on slugs
 * silently dropped from normalized output.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAddonSelections,
  sortAddonsForDisplay,
  type ProductAddonRow,
} from "../lib/capabilities/composition/add-ons.ts";

const tent = "p-tent";
const sidewalls = "p-sidewalls";
const lighting = "p-lighting";
const heating = "p-heating";

const makeRow = (overrides: Partial<ProductAddonRow> & {
  addonProductId: string;
}): ProductAddonRow => ({
  id: `row-${overrides.addonProductId}`,
  parentProductId: tent,
  defaultQuantity: 1,
  maxQuantity: null,
  isRequired: false,
  displayOrder: 0,
  ...overrides,
});

test("no add-ons available + no selections → ok, empty normalized", () => {
  const r = validateAddonSelections([], []);
  assert.deepEqual(r, { ok: true, errors: [], normalizedSelections: [] });
});

test("optional add-ons not selected → ok", () => {
  const r = validateAddonSelections(
    [makeRow({ addonProductId: sidewalls }), makeRow({ addonProductId: lighting })],
    [],
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test("optional add-on selected with valid qty → ok, kept in normalized", () => {
  const r = validateAddonSelections(
    [makeRow({ addonProductId: lighting, maxQuantity: 4 })],
    [{ addonProductId: lighting, quantity: 2 }],
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.normalizedSelections, [
    { addonProductId: lighting, quantity: 2 },
  ]);
});

test("required add-on missing → error", () => {
  const r = validateAddonSelections(
    [makeRow({ addonProductId: heating, isRequired: true, defaultQuantity: 1 })],
    [],
  );
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0]?.reason, "required_missing");
  if (r.errors[0]?.reason === "required_missing") {
    assert.equal(r.errors[0].required, 1);
  }
});

test("required add-on selected at exactly default → ok", () => {
  const r = validateAddonSelections(
    [makeRow({ addonProductId: heating, isRequired: true, defaultQuantity: 2 })],
    [{ addonProductId: heating, quantity: 2 }],
  );
  assert.equal(r.ok, true);
});

test("required add-on selected below default → error", () => {
  const r = validateAddonSelections(
    [makeRow({ addonProductId: heating, isRequired: true, defaultQuantity: 3 })],
    [{ addonProductId: heating, quantity: 1 }],
  );
  assert.equal(r.ok, false);
  assert.equal(r.errors[0]?.reason, "below_required_default");
  if (r.errors[0]?.reason === "below_required_default") {
    assert.equal(r.errors[0].selected, 1);
    assert.equal(r.errors[0].required, 3);
  }
});

test("selection exceeds max → error", () => {
  const r = validateAddonSelections(
    [makeRow({ addonProductId: sidewalls, maxQuantity: 4 })],
    [{ addonProductId: sidewalls, quantity: 10 }],
  );
  assert.equal(r.ok, false);
  assert.equal(r.errors[0]?.reason, "exceeds_max");
});

test("null maxQuantity means no cap", () => {
  const r = validateAddonSelections(
    [makeRow({ addonProductId: sidewalls, maxQuantity: null })],
    [{ addonProductId: sidewalls, quantity: 999 }],
  );
  assert.equal(r.ok, true);
});

test("negative quantity clamped to 0; required addon then errors as missing", () => {
  const r = validateAddonSelections(
    [makeRow({ addonProductId: heating, isRequired: true, defaultQuantity: 1 })],
    [{ addonProductId: heating, quantity: -5 }],
  );
  assert.equal(r.ok, false);
  assert.equal(r.errors[0]?.reason, "required_missing");
});

test("fractional quantity truncated", () => {
  // 2.9 → 2, which is below max=3 — passes.
  const r = validateAddonSelections(
    [makeRow({ addonProductId: lighting, maxQuantity: 3 })],
    [{ addonProductId: lighting, quantity: 2.9 }],
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.normalizedSelections, [
    { addonProductId: lighting, quantity: 2 },
  ]);
});

test("unknown addon in selection silently dropped from normalized", () => {
  const r = validateAddonSelections(
    [makeRow({ addonProductId: sidewalls })],
    [
      { addonProductId: sidewalls, quantity: 2 },
      { addonProductId: "p-not-a-real-addon", quantity: 5 },
    ],
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.normalizedSelections, [
    { addonProductId: sidewalls, quantity: 2 },
  ]);
});

test("duplicate selections for same addon: last write wins", () => {
  const r = validateAddonSelections(
    [makeRow({ addonProductId: sidewalls, maxQuantity: 4 })],
    [
      { addonProductId: sidewalls, quantity: 1 },
      { addonProductId: sidewalls, quantity: 3 },
    ],
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.normalizedSelections, [
    { addonProductId: sidewalls, quantity: 3 },
  ]);
});

test("zero qty for optional addon → ok, excluded from normalized", () => {
  const r = validateAddonSelections(
    [makeRow({ addonProductId: lighting })],
    [{ addonProductId: lighting, quantity: 0 }],
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.normalizedSelections, []);
});

test("realistic tent scenario: 4 sidewalls + lighting, no heating", () => {
  const r = validateAddonSelections(
    [
      makeRow({ addonProductId: sidewalls, maxQuantity: 4, displayOrder: 1 }),
      makeRow({ addonProductId: lighting, maxQuantity: 1, displayOrder: 2 }),
      makeRow({ addonProductId: heating, maxQuantity: 1, displayOrder: 3 }),
    ],
    [
      { addonProductId: sidewalls, quantity: 4 },
      { addonProductId: lighting, quantity: 1 },
    ],
  );
  assert.equal(r.ok, true);
  assert.equal(r.normalizedSelections.length, 2);
});

test("sortAddonsForDisplay orders by displayOrder ascending + is pure", () => {
  const input = [
    makeRow({ addonProductId: "c", displayOrder: 30 }),
    makeRow({ addonProductId: "a", displayOrder: 10 }),
    makeRow({ addonProductId: "b", displayOrder: 20 }),
  ];
  const inputSnapshot = [...input];
  const sorted = sortAddonsForDisplay(input);

  assert.deepEqual(sorted.map((a) => a.addonProductId), ["a", "b", "c"]);
  // Pure: did not mutate input
  assert.deepEqual(input, inputSnapshot);
});

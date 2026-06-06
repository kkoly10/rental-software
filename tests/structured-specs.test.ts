/**
 * Phase 1c — structured-specs capability.
 *
 * sortSpecsForDisplay must be pure (no mutation) and stable (rows
 * with equal display_order keep input order). Pinning both since
 * future PDP rendering depends on deterministic ordering.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  sortSpecsForDisplay,
  type ProductSpec,
} from "../lib/capabilities/display/structured-specs.ts";

const make = (
  partial: Partial<ProductSpec> & { displayOrder: number; specKey: string },
): ProductSpec => ({
  id: `id-${partial.specKey}`,
  productId: "p1",
  specLabel: partial.specKey,
  specValue: "v",
  ...partial,
});

test("sorts by display_order ascending", () => {
  const sorted = sortSpecsForDisplay([
    make({ specKey: "a", displayOrder: 30 }),
    make({ specKey: "b", displayOrder: 10 }),
    make({ specKey: "c", displayOrder: 20 }),
  ]);
  assert.deepEqual(sorted.map((s) => s.specKey), ["b", "c", "a"]);
});

test("rows with equal display_order preserve input order (stable)", () => {
  const sorted = sortSpecsForDisplay([
    make({ specKey: "x", displayOrder: 5 }),
    make({ specKey: "y", displayOrder: 5 }),
    make({ specKey: "z", displayOrder: 5 }),
  ]);
  assert.deepEqual(sorted.map((s) => s.specKey), ["x", "y", "z"]);
});

test("does not mutate the input array", () => {
  const input: ProductSpec[] = [
    make({ specKey: "a", displayOrder: 30 }),
    make({ specKey: "b", displayOrder: 10 }),
  ];
  const inputCopy = [...input];
  sortSpecsForDisplay(input);
  assert.deepEqual(input, inputCopy);
});

test("empty input → empty output", () => {
  assert.deepEqual(sortSpecsForDisplay([]), []);
});

test("realistic concession specs in operator-entered order", () => {
  const sorted = sortSpecsForDisplay([
    make({ specKey: "servings", displayOrder: 3 }),
    make({ specKey: "power", displayOrder: 1 }),
    make({ specKey: "footprint", displayOrder: 2 }),
    make({ specKey: "included", displayOrder: 4 }),
  ]);
  assert.deepEqual(sorted.map((s) => s.specKey), [
    "power",
    "footprint",
    "servings",
    "included",
  ]);
});

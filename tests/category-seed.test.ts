import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  nextSortOrders,
  slugifyCategoryName,
} from "../lib/verticals/category-seed.ts";

// Phase 4j — pin the slug + sort-order helpers extracted from the
// addOrgVertical action (#299). The DB-side category seeds depend on
// these producing the same shape every release; a refactor that
// breaks slug stability would silently rename or duplicate buckets.

test("slugifyCategoryName lowercases and hyphenates", () => {
  assert.equal(slugifyCategoryName("Frame Tent"), "frame-tent");
  assert.equal(slugifyCategoryName("CHIAVARI CHAIR"), "chiavari-chair");
});

test("slugifyCategoryName collapses runs of non-alphanumerics", () => {
  assert.equal(slugifyCategoryName("Round Table — 60in"), "round-table-60in");
  assert.equal(slugifyCategoryName("LED + Stage Sections"), "led-stage-sections");
  assert.equal(slugifyCategoryName("  trim me  "), "trim-me");
});

test("slugifyCategoryName strips leading + trailing hyphens", () => {
  assert.equal(slugifyCategoryName("— tents —"), "tents");
  assert.equal(slugifyCategoryName("---"), "");
});

test("slugifyCategoryName preserves digits + idempotent", () => {
  assert.equal(slugifyCategoryName("Tent 20x40"), "tent-20x40");
  const once = slugifyCategoryName("Tent 20x40");
  assert.equal(slugifyCategoryName(once), once);
});

test("nextSortOrders appends after the existing max", () => {
  assert.deepEqual(nextSortOrders(0, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(nextSortOrders(7, 3), [8, 9, 10]);
});

test("nextSortOrders clamps negative startSort to 0", () => {
  assert.deepEqual(nextSortOrders(-99, 2), [1, 2]);
});

test("nextSortOrders truncates fractional startSort", () => {
  assert.deepEqual(nextSortOrders(4.9, 2), [5, 6]);
});

test("nextSortOrders returns empty array for non-positive count", () => {
  assert.deepEqual(nextSortOrders(7, 0), []);
  assert.deepEqual(nextSortOrders(7, -5), []);
});

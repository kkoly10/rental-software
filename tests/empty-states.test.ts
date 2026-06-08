import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  getEmptyStateCopy,
  getStarterExample,
} from "../lib/verticals/empty-states.ts";

// Phase 3c/3d — vertical-aware empty-state + starter copy. The helper
// is the source of truth for what an operator sees on a zero-state
// list; if the wrong vertical was ever to fall through, a tents
// operator would land on inflatable-flavour copy. These tests pin the
// happy path + fallback so a refactor can't silently drop a vertical
// or a surface.

const REGISTRY_VERTICALS = [
  "inflatable",
  "tents",
  "tables-and-chairs",
  "dance-floors",
  "photo-booths",
  "concessions",
] as const;

const SURFACES = ["products", "orders", "customers"] as const;

test("every registry vertical declares copy for every surface", () => {
  for (const vertical of REGISTRY_VERTICALS) {
    for (const surface of SURFACES) {
      const copy = getEmptyStateCopy(vertical, surface);
      assert.ok(copy, `missing ${vertical}/${surface}`);
      assert.ok(copy!.title.length > 0, `${vertical}/${surface} title empty`);
      assert.ok(
        copy!.description.length > 0,
        `${vertical}/${surface} description empty`,
      );
      assert.ok(
        copy!.actionLabel.length > 0,
        `${vertical}/${surface} actionLabel empty`,
      );
    }
  }
});

test("unknown business_type returns null on every surface", () => {
  for (const surface of SURFACES) {
    assert.equal(getEmptyStateCopy("unknown-vertical", surface), null);
    assert.equal(getEmptyStateCopy("car", surface), null);
    assert.equal(getEmptyStateCopy("equipment", surface), null);
  }
});

test("undefined / empty business_type returns null", () => {
  for (const surface of SURFACES) {
    assert.equal(getEmptyStateCopy(undefined, surface), null);
    assert.equal(getEmptyStateCopy("", surface), null);
  }
});

test("each vertical's product copy mentions a domain-specific noun", () => {
  // Smoke test that the products empty state actually reads
  // vertical-flavoured. If someone copies the inflatable copy for
  // every vertical, this catches it.
  const tents = getEmptyStateCopy("tents", "products")!;
  assert.ok(/tent/i.test(tents.title), "tents title should mention tent");

  const tac = getEmptyStateCopy("tables-and-chairs", "products")!;
  assert.ok(
    /tables? or chairs?|chair|table/i.test(tac.title),
    "tables-and-chairs title should mention chair/table",
  );

  const floors = getEmptyStateCopy("dance-floors", "products")!;
  assert.ok(
    /dance floor/i.test(floors.title),
    "dance-floors title should mention dance floor",
  );

  const inflatable = getEmptyStateCopy("inflatable", "products")!;
  assert.ok(
    /bouncer/i.test(inflatable.title),
    "inflatable title should mention bouncer",
  );

  const photoBooths = getEmptyStateCopy("photo-booths", "products")!;
  assert.ok(
    /booth/i.test(photoBooths.title),
    "photo-booths title should mention booth",
  );

  const concessions = getEmptyStateCopy("concessions", "products")!;
  assert.ok(
    /machine/i.test(concessions.title),
    "concessions title should mention machine",
  );
});

test("every registry vertical has a starter example", () => {
  for (const vertical of REGISTRY_VERTICALS) {
    const ex = getStarterExample(vertical);
    assert.ok(ex, `missing starter example for ${vertical}`);
    assert.ok(ex!.name.length > 0);
    assert.ok(ex!.price.length > 0);
    assert.ok(ex!.description.length > 0);
  }
});

test("starter example returns null for unknown / undefined verticals", () => {
  assert.equal(getStarterExample("unknown"), null);
  assert.equal(getStarterExample(undefined), null);
  assert.equal(getStarterExample(""), null);
  assert.equal(getStarterExample("car"), null);
});

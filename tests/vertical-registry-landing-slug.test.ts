/**
 * Phase 2a — vertical registry helpers used by the dynamic
 * /[vertical] route. Pins the contract:
 *   - findVerticalByLandingSlug("inflatable-rental-software") → inflatable
 *   - findVerticalByLandingSlug("unknown") → undefined
 *   - listLandingPageSlugs() includes every vertical's slug exactly once
 *
 * A regression here means either a 404 for a valid URL or a 200 for
 * a typo — both are user-visible.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  findVerticalByLandingSlug,
  listLandingPageSlugs,
  listVerticals,
} from "../lib/verticals/registry.ts";

test("findVerticalByLandingSlug resolves the inflatable marketing URL", () => {
  const v = findVerticalByLandingSlug("inflatable-rental-software");
  assert.ok(v, "inflatable should resolve via its landing slug");
  assert.equal(v?.slug, "inflatable");
});

test("findVerticalByLandingSlug returns undefined for an unknown slug", () => {
  assert.equal(findVerticalByLandingSlug("does-not-exist"), undefined);
});

test("findVerticalByLandingSlug returns undefined for the empty string", () => {
  assert.equal(findVerticalByLandingSlug(""), undefined);
});

test("findVerticalByLandingSlug is case-sensitive (URL slugs are lowercased by convention)", () => {
  // We don't lowercase here — if a future operator types a Capitalized
  // URL into a browser, the canonical resolution should fail loudly
  // rather than silently serve content.
  assert.equal(
    findVerticalByLandingSlug("Inflatable-Rental-Software"),
    undefined,
  );
});

test("listLandingPageSlugs returns one slug per registered vertical, unique", () => {
  const slugs = listLandingPageSlugs();
  const verticals = listVerticals();
  assert.equal(slugs.length, verticals.length);
  assert.equal(slugs.length, new Set(slugs).size, "slugs must be unique");
});

test("listLandingPageSlugs includes the inflatable slug", () => {
  const slugs = listLandingPageSlugs();
  assert.ok(slugs.includes("inflatable-rental-software"));
});

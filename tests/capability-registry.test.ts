/**
 * Phase 0 — capability + vertical registry sanity tests.
 *
 * These tests are deliberately small and structural. They verify the
 * registry is wired correctly so a typo in a vertical's capability
 * list (or a renamed slug) fails CI loudly rather than at runtime in
 * a dispatch path that doesn't exist yet.
 *
 * As Phase 1+ adds dispatch behavior (computeLineTotal, pull-sheet
 * formatters, etc.), peer tests under tests/capabilities/*.test.ts
 * will cover the business logic per capability.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  getCapability,
  listCapabilities,
  listCapabilitiesByGroup,
  validateCapabilitySlugs,
} from "../lib/capabilities/registry.ts";

import {
  getVertical,
  listVerticals,
  listVerticalSlugs,
} from "../lib/verticals/registry.ts";

import { flatDayPricing } from "../lib/capabilities/pricing/flat-day.ts";
import { wetDryMode } from "../lib/capabilities/mode/wet-dry.ts";
import { anchoringSetup } from "../lib/capabilities/setup/anchoring.ts";
import { surfaceTypeSetup } from "../lib/capabilities/setup/surface-type.ts";

test("getCapability returns each registered capability by slug", () => {
  assert.equal(getCapability("pricing.flat-day"), flatDayPricing);
  assert.equal(getCapability("mode.wet-dry"), wetDryMode);
  assert.equal(getCapability("setup.anchoring"), anchoringSetup);
  assert.equal(getCapability("setup.surface-type"), surfaceTypeSetup);
});

test("getCapability returns undefined for an unknown slug", () => {
  assert.equal(getCapability("pricing.does-not-exist"), undefined);
});

test("listCapabilities exposes every registered capability exactly once", () => {
  const slugs = listCapabilities().map((c) => c.slug);
  assert.equal(slugs.length, new Set(slugs).size, "slugs must be unique");
  for (const slug of ["pricing.flat-day", "mode.wet-dry", "setup.anchoring", "setup.surface-type"]) {
    assert.ok(slugs.includes(slug), `expected slug ${slug} in registry`);
  }
});

test("listCapabilitiesByGroup partitions the registry by group", () => {
  const pricing = listCapabilitiesByGroup("pricing").map((c) => c.slug);
  const mode = listCapabilitiesByGroup("mode").map((c) => c.slug);
  const setup = listCapabilitiesByGroup("setup").map((c) => c.slug);

  assert.deepEqual([...pricing].sort(), ["pricing.flat-day"]);
  assert.deepEqual([...mode].sort(), ["mode.wet-dry"]);
  assert.deepEqual([...setup].sort(), ["setup.anchoring", "setup.surface-type"]);
});

test("validateCapabilitySlugs accepts an all-known list", () => {
  const result = validateCapabilitySlugs(["pricing.flat-day", "mode.wet-dry"]);
  assert.deepEqual(result, { ok: true });
});

test("validateCapabilitySlugs reports unknown slugs without throwing", () => {
  const result = validateCapabilitySlugs([
    "pricing.flat-day",
    "pricing.bogus",
    "setup.unknown",
  ]);
  assert.equal(result.ok, false);
  if (result.ok === false) {
    assert.deepEqual([...result.unknownSlugs].sort(), ["pricing.bogus", "setup.unknown"]);
  }
});

test("getVertical returns the inflatable vertical config", () => {
  const v = getVertical("inflatable");
  assert.ok(v, "inflatable vertical should be registered");
  assert.equal(v?.slug, "inflatable");
  assert.equal(v?.label.en, "Inflatables");
});

test("getVertical returns undefined for an unknown slug", () => {
  assert.equal(getVertical("photo-booths"), undefined);
});

test("listVerticals + listVerticalSlugs include inflatable in Phase 0", () => {
  const slugs = listVerticalSlugs();
  assert.ok(slugs.includes("inflatable"));
  const verticals = listVerticals();
  assert.equal(verticals.length, slugs.length);
});

test("every vertical's capability slugs are registered (boot-time invariant)", () => {
  // The registry module throws at import-time if a vertical references
  // an unknown capability — reaching this assert means that throw didn't
  // fire, which is the whole guarantee we want. Re-validate explicitly
  // so the assertion is visible in the test report.
  for (const v of listVerticals()) {
    const result = validateCapabilitySlugs(v.capabilities);
    assert.equal(
      result.ok,
      true,
      `vertical ${v.slug} references unknown capability slugs: ${
        result.ok === false ? result.unknownSlugs.join(", ") : ""
      }`,
    );
  }
});

/**
 * Sprint 6.0 — wet/dry inflatable pricing.
 *
 * The pure pricing helper is what the checkout action calls to compute
 * each order_item's line_total when a customer picks wet vs dry. A
 * regression here means either (a) we silently charge the wet
 * upcharge on a dry rental or (b) we silently DROP the upcharge on a
 * wet rental — either is the kind of money bug we ship a hotfix for.
 *
 * Pinning the (mode, supports_modes, upcharge, quantity) → line_total
 * table here so any future tweak to the helper is visible in the diff.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  computeInflatableLineTotal,
  normalizeSelectedMode,
} from "../lib/pricing/inflatable-mode.ts";

test("single-mode dry product → line total is base * quantity", () => {
  const result = computeInflatableLineTotal({
    basePriceCents: 30000, // $300
    quantity: 1,
    supportsModes: ["dry"],
    selectedMode: null,
    wetUpchargeCents: null,
  });
  assert.equal(result.lineTotalCents, 30000);
  assert.equal(result.appliedWetUpcharge, false);
});

test("dual-mode product, customer picks dry → no upcharge", () => {
  const result = computeInflatableLineTotal({
    basePriceCents: 30000,
    quantity: 1,
    supportsModes: ["dry", "wet"],
    selectedMode: "dry",
    wetUpchargeCents: 5000,
  });
  assert.equal(result.lineTotalCents, 30000);
  assert.equal(result.appliedWetUpcharge, false);
});

test("dual-mode product, customer picks wet → upcharge applied per unit", () => {
  const result = computeInflatableLineTotal({
    basePriceCents: 30000,
    quantity: 1,
    supportsModes: ["dry", "wet"],
    selectedMode: "wet",
    wetUpchargeCents: 5000,
  });
  assert.equal(result.lineTotalCents, 35000);
  assert.equal(result.appliedWetUpcharge, true);
});

test("wet upcharge multiplies by quantity, NOT once per line", () => {
  // Two wet slides at $300 + $50 each = $700, not $650.
  const result = computeInflatableLineTotal({
    basePriceCents: 30000,
    quantity: 2,
    supportsModes: ["dry", "wet"],
    selectedMode: "wet",
    wetUpchargeCents: 5000,
  });
  assert.equal(result.lineTotalCents, 70000);
  assert.equal(result.appliedWetUpcharge, true);
});

test("dual-mode product, wet selected, but upcharge is null → base price only", () => {
  // Operator forgot to set the upcharge after enabling wet. We choose
  // to bill the base price (no surprise charge) rather than refusing
  // the booking — the customer sees the same price they were shown on
  // the storefront.
  const result = computeInflatableLineTotal({
    basePriceCents: 30000,
    quantity: 1,
    supportsModes: ["dry", "wet"],
    selectedMode: "wet",
    wetUpchargeCents: null,
  });
  assert.equal(result.lineTotalCents, 30000);
  assert.equal(result.appliedWetUpcharge, false);
});

test("wet selected on a product that doesn't support wet → no upcharge", () => {
  // Defensive: shouldn't happen in normal flow because the storefront
  // doesn't render the wet radio, but a crafted POST or a stale tab
  // shouldn't bill a customer extra.
  const result = computeInflatableLineTotal({
    basePriceCents: 30000,
    quantity: 1,
    supportsModes: ["dry"],
    selectedMode: "wet",
    wetUpchargeCents: 5000,
  });
  assert.equal(result.lineTotalCents, 30000);
  assert.equal(result.appliedWetUpcharge, false);
});

test("zero/negative quantity floors to zero — never goes negative", () => {
  const zero = computeInflatableLineTotal({
    basePriceCents: 30000,
    quantity: 0,
    supportsModes: ["dry"],
    selectedMode: null,
    wetUpchargeCents: null,
  });
  assert.equal(zero.lineTotalCents, 0);

  const negative = computeInflatableLineTotal({
    basePriceCents: 30000,
    quantity: -5,
    supportsModes: ["dry"],
    selectedMode: null,
    wetUpchargeCents: null,
  });
  assert.equal(negative.lineTotalCents, 0);
});

test("normalizeSelectedMode accepts 'dry' and 'wet', rejects everything else", () => {
  assert.equal(normalizeSelectedMode("dry"), "dry");
  assert.equal(normalizeSelectedMode("wet"), "wet");
  assert.equal(normalizeSelectedMode("DRY"), null);
  assert.equal(normalizeSelectedMode(""), null);
  assert.equal(normalizeSelectedMode(null), null);
  assert.equal(normalizeSelectedMode(undefined), null);
  assert.equal(normalizeSelectedMode(42), null);
  assert.equal(normalizeSelectedMode({ mode: "wet" }), null);
});

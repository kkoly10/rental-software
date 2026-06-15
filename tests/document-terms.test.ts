/**
 * Document terms coverage (Phase D). Photo booths and concessions used
 * to fall through to the generic event-rental block — which gave, e.g.,
 * a photo-booth customer a waiver clause about "no climbing on tents."
 * Pin that every registry vertical now resolves dedicated, on-topic
 * terms, and that the attended verticals never inherit the tent text.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getTerms, resolveDocumentClauses } from "../lib/documents/terms.ts";
import { listVerticalSlugs } from "../lib/verticals/registry.ts";

test("every registry vertical resolves non-empty terms for both doc types", () => {
  for (const slug of listVerticalSlugs()) {
    for (const type of ["rental_agreement", "safety_waiver"] as const) {
      const terms = getTerms(type, slug);
      assert.ok(terms.length > 0, `${slug}/${type} has no terms`);
    }
  }
});

test("photo-booth + concession waivers don't inherit the tent/climbing text", () => {
  for (const slug of ["photo-booths", "concessions"]) {
    const waiver = getTerms("safety_waiver", slug).join(" ");
    assert.doesNotMatch(waiver, /\btents?\b/i, `${slug} waiver still mentions tents`);
  }
});

test("attended verticals get on-topic agreement terms", () => {
  assert.match(getTerms("rental_agreement", "photo-booths").join(" "), /attendant/i);
  assert.match(getTerms("rental_agreement", "concessions").join(" "), /power|consumable/i);
});

test("the 'other' general vertical gets neutral terms, not event boilerplate", () => {
  // A true general vertical (tools/AV/furniture) must not inherit
  // venue/weather/setup-crew language that reads wrong off-event.
  for (const type of ["rental_agreement", "safety_waiver"] as const) {
    const terms = getTerms(type, "other").join(" ");
    assert.doesNotMatch(terms, /\bvenue\b|\bweather\b|setup area|installation/i,
      `other/${type} still carries event-rental language`);
  }
  // And it should NOT silently fall through to the generic event block.
  assert.notDeepEqual(
    getTerms("rental_agreement", "other"),
    getTerms("rental_agreement", "totally-unknown"),
    "other should resolve dedicated general terms, not the event fallback",
  );
});

test("an unknown vertical still falls back to non-empty generic terms", () => {
  assert.ok(getTerms("rental_agreement", "totally-unknown").length > 0);
  assert.ok(getTerms("safety_waiver", "totally-unknown").length > 0);
});

test("resolveDocumentClauses: custom clauses win when present", () => {
  const custom = ["1. CUSTOM CLAUSE A", "2. CUSTOM CLAUSE B"];
  assert.deepEqual(resolveDocumentClauses(custom, "rental_agreement", "tents"), custom);
});

test("resolveDocumentClauses: blank/empty custom falls back to defaults", () => {
  const defaults = getTerms("safety_waiver", "tents");
  assert.deepEqual(resolveDocumentClauses(undefined, "safety_waiver", "tents"), defaults);
  assert.deepEqual(resolveDocumentClauses([], "safety_waiver", "tents"), defaults);
  assert.deepEqual(resolveDocumentClauses(["  ", ""], "safety_waiver", "tents"), defaults);
});

test("resolveDocumentClauses trims blanks but keeps real custom clauses", () => {
  assert.deepEqual(
    resolveDocumentClauses(["  keep me  ", "  "], "rental_agreement", "tents"),
    ["keep me"],
  );
});

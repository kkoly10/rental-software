/**
 * isGeneralVertical drives whether the storefront uses neutral "rental"
 * copy (general/other) or the event-rental copy (the marketed six). Pin
 * the contract: only the setup-only catch-all is "general", every
 * marketed event vertical is not, and unknown/empty is treated as
 * event (the safe default that preserves existing copy).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isGeneralVertical } from "../lib/verticals/customer-language.ts";

test("the setup-only 'other' vertical is general", () => {
  assert.equal(isGeneralVertical("other"), true);
});

test("the marketed event verticals are NOT general", () => {
  for (const slug of [
    "inflatable",
    "tents",
    "tables-and-chairs",
    "dance-floors",
    "photo-booths",
    "concessions",
  ]) {
    assert.equal(isGeneralVertical(slug), false, `${slug} should not be general`);
  }
});

test("unknown / empty falls back to event (not general)", () => {
  assert.equal(isGeneralVertical(null), false);
  assert.equal(isGeneralVertical(undefined), false);
  assert.equal(isGeneralVertical(""), false);
  assert.equal(isGeneralVertical("totally-unknown"), false);
});

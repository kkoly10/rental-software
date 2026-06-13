/**
 * Listing quality score (Phase 3, sprint §6). Pins the deterministic
 * weights, the photo-count scaling, the proof-required asymmetry, and
 * the "top 3 suggestions by biggest point gain" ordering. The score
 * never gates publishing — that contract lives in seller-actions — but
 * the math that drives the warning lives here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  scoreListing,
  SCORE_LOW_THRESHOLD,
  type ListingScoreInput,
} from "../lib/market/listing-score.ts";

const base: ListingScoreInput = {
  photoCount: 0,
  title: "",
  description: null,
  hasWeekendPrice: false,
  hasWeeklyPrice: false,
  replacementValueCents: null,
  proofVideoPresent: false,
  proofRequired: false,
};

test("empty listing floors low; only the non-required proof + base pricing earn", () => {
  const s = scoreListing(base);
  // title floor 3 + proof (optional, absent) 9 + replacement 4 + pricing base 4 → 20
  assert.equal(s.score, 20);
  assert.ok(s.score < SCORE_LOW_THRESHOLD);
});

test("a fully complete listing scores 100", () => {
  const s = scoreListing({
    photoCount: 5,
    title: "20x30 white frame tent, seats 60",
    description: "x".repeat(300),
    hasWeekendPrice: true,
    hasWeeklyPrice: true,
    replacementValueCents: 250_000,
    proofVideoPresent: true,
    proofRequired: false,
  });
  assert.equal(s.score, 100);
  assert.equal(s.suggestions.length, 0);
});

test("photos scale with count: 1<2<3<4 and cap at 4", () => {
  const at = (n: number) => scoreListing({ ...base, photoCount: n }).components.find((c) => c.key === "photos")!.earned;
  assert.equal(at(0), 0);
  assert.equal(at(1), 9);
  assert.equal(at(2), 18);
  assert.equal(at(3), 26);
  assert.equal(at(4), 35);
  assert.equal(at(6), 35); // capped
});

test("proof-required category gets 0 when video absent, 15 when present", () => {
  const absent = scoreListing({ ...base, proofRequired: true });
  assert.equal(absent.components.find((c) => c.key === "proof")!.earned, 0);
  const present = scoreListing({ ...base, proofRequired: true, proofVideoPresent: true });
  assert.equal(present.components.find((c) => c.key === "proof")!.earned, 15);
});

test("optional proof: absent still earns most of the weight (9/15)", () => {
  assert.equal(scoreListing(base).components.find((c) => c.key === "proof")!.earned, 9);
});

test("suggestions are the biggest point gains first, max 3", () => {
  // photos (gain 35) > description (20) > title (10) here.
  const s = scoreListing({ ...base, replacementValueCents: 100_000, hasWeekendPrice: true, hasWeeklyPrice: true });
  assert.equal(s.suggestions.length, 3);
  assert.match(s.suggestions[0], /photo/i);
  assert.match(s.suggestions[1], /description/i);
});

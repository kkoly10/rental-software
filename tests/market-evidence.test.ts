/**
 * Evidence ladder (Phase 1, the locked rental flow). The presumption
 * rules the founder adjudicates against — and the blocking gate
 * (sellerBaselinePresent) the deposit-capture guard reads — are pinned
 * here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  summarizeEvidenceRows,
  type EvidenceRow,
} from "../lib/market/evidence-summary.ts";

const row = (
  phase: "handoff" | "return",
  party: "seller" | "renter",
  photo: boolean,
  created_at = "2026-06-13T12:00:00Z",
): EvidenceRow => ({ phase, party, photo_url: photo ? "p.jpg" : null, created_at });

test("empty evidence: no baseline, all sets zero", () => {
  const s = summarizeEvidenceRows([]);
  assert.equal(s.sellerBaselinePresent, false);
  assert.equal(s.sellerHandoff.photoCount, 0);
  assert.equal(s.renterReturn.photoCount, 0);
});

test("seller baseline present only when a seller handoff PHOTO exists", () => {
  // A note-only seller handoff row does not establish a baseline.
  const noteOnly = summarizeEvidenceRows([row("handoff", "seller", false)]);
  assert.equal(noteOnly.sellerHandoff.noteCount, 1);
  assert.equal(noteOnly.sellerBaselinePresent, false);

  const withPhoto = summarizeEvidenceRows([row("handoff", "seller", true)]);
  assert.equal(withPhoto.sellerBaselinePresent, true);
});

test("rows are routed to the correct phase/party set", () => {
  const s = summarizeEvidenceRows([
    row("handoff", "seller", true),
    row("handoff", "seller", true),
    row("handoff", "renter", true),
    row("return", "renter", true),
    row("return", "seller", false),
  ]);
  assert.equal(s.sellerHandoff.photoCount, 2);
  assert.equal(s.renterHandoff.photoCount, 1);
  assert.equal(s.renterReturn.photoCount, 1);
  assert.equal(s.sellerReturn.photoCount, 0);
  assert.equal(s.sellerReturn.noteCount, 1);
  assert.equal(s.sellerBaselinePresent, true);
});

test("first/last timestamps track the span of a set", () => {
  const s = summarizeEvidenceRows([
    row("handoff", "seller", true, "2026-06-13T10:00:00Z"),
    row("handoff", "seller", true, "2026-06-13T10:05:00Z"),
    row("handoff", "seller", true, "2026-06-13T09:55:00Z"),
  ]);
  assert.equal(s.sellerHandoff.firstAt, "2026-06-13T09:55:00Z");
  assert.equal(s.sellerHandoff.lastAt, "2026-06-13T10:05:00Z");
});

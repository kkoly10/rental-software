import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCopilotPaymentReferenceNote,
  COPILOT_PAYMENT_MARKER,
} from "../lib/copilot/payment-note.ts";

// Fixed instant so the embedded timestamp is deterministic in assertions.
const AT = new Date("2026-06-04T14:52:30.000Z");
const STAMP = `${COPILOT_PAYMENT_MARKER} on 2026-06-04 14:52 UTC`;

test("stamps the marker + UTC timestamp when there is no operator note", () => {
  assert.equal(buildCopilotPaymentReferenceNote(undefined, AT), STAMP);
  assert.equal(buildCopilotPaymentReferenceNote("", AT), STAMP);
  assert.equal(buildCopilotPaymentReferenceNote("   ", AT), STAMP);
});

test("appends the operator note after the marker + timestamp", () => {
  assert.equal(
    buildCopilotPaymentReferenceNote("Check #1234", AT),
    `${STAMP} — Check #1234`
  );
});

test("trims surrounding whitespace from the operator note", () => {
  assert.equal(
    buildCopilotPaymentReferenceNote("  Venmo  ", AT),
    `${STAMP} — Venmo`
  );
});

test("records the time in UTC, not local time", () => {
  const result = buildCopilotPaymentReferenceNote(undefined, AT);
  assert.ok(result.endsWith("UTC"));
  assert.ok(result.includes("2026-06-04 14:52"));
});

test("never exceeds the 120-char limit and keeps the marker + timestamp", () => {
  const long = "x".repeat(300);
  const result = buildCopilotPaymentReferenceNote(long, AT);
  assert.ok(result.length <= 120, `length was ${result.length}`);
  assert.ok(result.startsWith(STAMP));
});

test("defaults to the current time when no timestamp is supplied", () => {
  const result = buildCopilotPaymentReferenceNote();
  assert.ok(result.startsWith(COPILOT_PAYMENT_MARKER));
  assert.ok(result.includes("UTC"));
});

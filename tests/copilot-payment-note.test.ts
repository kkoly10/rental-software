import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCopilotPaymentReferenceNote,
  COPILOT_PAYMENT_MARKER,
} from "../lib/copilot/payment-note.ts";

test("stamps the marker when there is no operator note", () => {
  assert.equal(buildCopilotPaymentReferenceNote(), COPILOT_PAYMENT_MARKER);
  assert.equal(buildCopilotPaymentReferenceNote(""), COPILOT_PAYMENT_MARKER);
  assert.equal(buildCopilotPaymentReferenceNote("   "), COPILOT_PAYMENT_MARKER);
});

test("appends the operator note after the marker", () => {
  assert.equal(
    buildCopilotPaymentReferenceNote("Check #1234"),
    `${COPILOT_PAYMENT_MARKER} — Check #1234`
  );
});

test("trims surrounding whitespace from the operator note", () => {
  assert.equal(
    buildCopilotPaymentReferenceNote("  Venmo  "),
    `${COPILOT_PAYMENT_MARKER} — Venmo`
  );
});

test("never exceeds the 120-char reference-note limit and keeps the marker", () => {
  const long = "x".repeat(300);
  const result = buildCopilotPaymentReferenceNote(long);
  assert.ok(result.length <= 120, `length was ${result.length}`);
  assert.ok(result.startsWith(COPILOT_PAYMENT_MARKER));
});

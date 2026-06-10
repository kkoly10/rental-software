/**
 * PR-2c — damage waiver cents math.
 *
 * The checkout, preview pricing card, and invoice PDF all read this
 * helper, so a regression here would silently desync the customer's
 * total from the order rows. Pinned end-to-end.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computeDamageWaiver } from "../lib/checkout/damage-waiver.ts";

test("not accepted → 0 regardless of rate / subtotal", () => {
  assert.deepEqual(
    computeDamageWaiver({ rentalSubtotal: 500, rateBps: 1000, accepted: false }),
    { amount: 0, rateBps: 0 }
  );
});

test("accepted + null rate (waiver not offered) → 0", () => {
  assert.deepEqual(
    computeDamageWaiver({ rentalSubtotal: 500, rateBps: null, accepted: true }),
    { amount: 0, rateBps: 0 }
  );
});

test("accepted + 0 rate → 0", () => {
  assert.deepEqual(
    computeDamageWaiver({ rentalSubtotal: 500, rateBps: 0, accepted: true }),
    { amount: 0, rateBps: 0 }
  );
});

test("10% on $500 → $50.00", () => {
  const out = computeDamageWaiver({ rentalSubtotal: 500, rateBps: 1000, accepted: true });
  assert.equal(out.amount, 50);
  assert.equal(out.rateBps, 1000);
});

test("8.5% on $725.50 rounds to the cent", () => {
  // 72550 cents × 850 / 10000 = 6166.75 → 6167 cents = $61.67
  const out = computeDamageWaiver({ rentalSubtotal: 725.5, rateBps: 850, accepted: true });
  assert.equal(out.amount, 61.67);
});

test("rate above the 5000-bps DB cap clamps to 50%", () => {
  const out = computeDamageWaiver({ rentalSubtotal: 100, rateBps: 9999, accepted: true });
  assert.equal(out.amount, 50);
  assert.equal(out.rateBps, 5000);
});

test("zero / negative subtotal → 0", () => {
  assert.equal(
    computeDamageWaiver({ rentalSubtotal: 0, rateBps: 1000, accepted: true }).amount,
    0
  );
  assert.equal(
    computeDamageWaiver({ rentalSubtotal: -10, rateBps: 1000, accepted: true }).amount,
    0
  );
});

test("negative rate (typo) treated as not offered", () => {
  assert.equal(
    computeDamageWaiver({ rentalSubtotal: 500, rateBps: -1000, accepted: true }).amount,
    0
  );
});

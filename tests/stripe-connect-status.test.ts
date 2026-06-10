/**
 * PR-2 — Stripe Connect Express status derivation.
 *
 * The dashboard card, the readiness banner, and the checkout gate
 * all read the SAME derivation, so this mapping is load-bearing in
 * three places. Pins every state + the column-mapping helpers.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveConnectStatus,
  canAcceptStripePayments,
  connectColumnsFromAccount,
  fieldsFromOrgRow,
} from "../lib/stripe/connect.ts";

test("no account id → not_connected", () => {
  assert.equal(
    deriveConnectStatus({
      accountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    }),
    "not_connected"
  );
});

test("account created, form abandoned → onboarding_incomplete", () => {
  assert.equal(
    deriveConnectStatus({
      accountId: "acct_1",
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    }),
    "onboarding_incomplete"
  );
});

test("details submitted, charges off → pending_verification", () => {
  assert.equal(
    deriveConnectStatus({
      accountId: "acct_1",
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: true,
    }),
    "pending_verification"
  );
});

test("charges enabled → ready (even if payouts still pending)", () => {
  assert.equal(
    deriveConnectStatus({
      accountId: "acct_1",
      chargesEnabled: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
    }),
    "ready"
  );
});

test("charges enabled trumps details_submitted=false (Stripe edge)", () => {
  // Stripe can momentarily report charges_enabled with stale
  // details_submitted during async webhook ordering — ready wins.
  assert.equal(
    deriveConnectStatus({
      accountId: "acct_1",
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: false,
    }),
    "ready"
  );
});

test("canAcceptStripePayments true only when ready", () => {
  const base = {
    accountId: "acct_1",
    payoutsEnabled: false,
    detailsSubmitted: true,
  };
  assert.equal(canAcceptStripePayments({ ...base, chargesEnabled: true }), true);
  assert.equal(canAcceptStripePayments({ ...base, chargesEnabled: false }), false);
  assert.equal(
    canAcceptStripePayments({
      accountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    }),
    false
  );
});

test("connectColumnsFromAccount maps + coerces nullish flags", () => {
  assert.deepEqual(
    connectColumnsFromAccount({
      id: "acct_42",
      charges_enabled: true,
      payouts_enabled: null,
      details_submitted: undefined,
    }),
    {
      stripe_connect_account_id: "acct_42",
      stripe_connect_charges_enabled: true,
      stripe_connect_payouts_enabled: false,
      stripe_connect_details_submitted: false,
    }
  );
});

test("fieldsFromOrgRow tolerates a null row (org not found)", () => {
  assert.deepEqual(fieldsFromOrgRow(null), {
    accountId: null,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
  });
});

test("fieldsFromOrgRow maps a live row", () => {
  assert.deepEqual(
    fieldsFromOrgRow({
      stripe_connect_account_id: "acct_9",
      stripe_connect_charges_enabled: true,
      stripe_connect_payouts_enabled: true,
      stripe_connect_details_submitted: true,
    }),
    {
      accountId: "acct_9",
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    }
  );
});

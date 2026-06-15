/**
 * Vertical-aware transactional email copy. emailCopy(locale, general=true)
 * swaps the event-framed strings for neutral rental wording; the default
 * (event) path is unchanged. (The parallel SMS deliveryCompletedGeneral
 * string is covered by tsc/build — lib/sms/templates uses path aliases that
 * node:test can't resolve here.)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { emailCopy } from "../lib/email/email-i18n.ts";

test("email: event verticals keep event wording (default path)", () => {
  const c = emailCopy("en");
  assert.match(c.orderStatus.statuses.delivered.body, /event/i);
  assert.match(c.postEventFollowUp.heading, /event/i);
});

test("email: general vertical swaps event wording for rental", () => {
  const c = emailCopy("en", true);
  assert.doesNotMatch(c.orderStatus.statuses.delivered.body, /\bevent\b/i);
  assert.doesNotMatch(c.orderStatus.statuses.completed.body, /\bevent\b/i);
  assert.doesNotMatch(c.postEventFollowUp.heading, /\bevent\b/i);
  assert.doesNotMatch(c.eventReminder.accessNote, /crew will handle/i);
  assert.doesNotMatch(c.paymentReceived.balanceDue("$50"), /\bevent\b/i);
});

test("email: general override is applied across every shipped locale", () => {
  for (const loc of ["en", "fr", "es", "pt"] as const) {
    const base = emailCopy(loc).orderStatus.statuses.delivered.body;
    const gen = emailCopy(loc, true).orderStatus.statuses.delivered.body;
    assert.notEqual(gen, base, `${loc}: general delivered body should differ from event copy`);
  }
});

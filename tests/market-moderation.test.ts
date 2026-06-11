import { test } from "node:test";
import assert from "node:assert/strict";

import { moderateMessage, blockedMessageCopy } from "../lib/market/moderation.ts";

test("§20 hard-block: payment handles and off-platform payment, any phase", () => {
  for (const phase of ["inquiry", "coordination"] as const) {
    assert.equal(moderateMessage("just venmo me instead", phase).verdict, "blocked");
    assert.equal(moderateMessage("I can do it cheaper outside the app", phase).verdict, "blocked");
    assert.equal(moderateMessage("pay me directly and skip the fee", phase).verdict, "blocked");
    assert.equal(moderateMessage("check bit.ly/abc123", phase).verdict, "blocked");
  }
});

test("§20/§24 phase-aware contact sharing: blocked pre-booking, legal in coordination", () => {
  const phone = "call me at 555-867-5309";
  const email = "reach me at dana@example.com";
  assert.equal(moderateMessage(phone, "inquiry").verdict, "blocked");
  assert.equal(moderateMessage(email, "inquiry").verdict, "blocked");
  assert.equal(moderateMessage(phone, "coordination").verdict, "clean");
  assert.equal(moderateMessage(email, "coordination").verdict, "clean");
});

test("§20 soft-warn: social handles and external links pass with a flag", () => {
  const ig = moderateMessage("find me on instagram for more pics", "inquiry");
  assert.equal(ig.verdict, "soft_warn");
  assert.ok(ig.reasons.includes("social_handle"));

  const link = moderateMessage("specs here https://example.com/tent-specs", "inquiry");
  assert.equal(link.verdict, "soft_warn");
  assert.ok(link.reasons.includes("external_link"));
});

test("platform links are not flagged; normal chat is clean", () => {
  assert.equal(
    moderateMessage("see https://rent.korent.app/market/listing/abc", "inquiry").verdict,
    "clean",
  );
  assert.equal(
    moderateMessage("Is the 20x30 available June 20-21? Does setup take long?", "inquiry").verdict,
    "clean",
  );
});

test("blocked copy explains without revealing rule internals", () => {
  const copy = blockedMessageCopy(["phone_pre_booking"]);
  assert.ok(copy.includes("after a booking is confirmed"));
  assert.ok(blockedMessageCopy(["payment_handle"]).includes("on the platform"));
});

test("block wins over warn when both trigger", () => {
  const v = moderateMessage("venmo me, also follow my instagram", "coordination");
  assert.equal(v.verdict, "blocked");
  assert.ok(v.reasons.includes("payment_handle"));
});

/**
 * Sprint 4.5 — Twilio inbound keyword detection.
 *
 * The /api/twilio/inbound route uses three keyword sets to decide what
 * the customer meant:
 *   - STOP / STOPALL / UNSUBSCRIBE etc. → opt OUT of SMS
 *   - START / YES / UNSTOP → opt IN to SMS
 *   - WHATSAPP / WAYES / etc. → opt IN to WhatsApp
 *   - WHATSAPP STOP / WA NO etc. → opt OUT of WhatsApp
 *
 * These sets are defined inline in the route file. Mistakes — a
 * keyword that ends up in two sets, a casing bug that makes "Whatsapp"
 * miss the match, an opt-in keyword that accidentally also opts the
 * customer out of SMS — silently mangle compliance. These tests pin
 * the rules.
 *
 * The route itself does Supabase + Twilio signature verification work
 * that can't be unit-tested cleanly. The keyword sets ARE testable
 * because they're pure data, so we re-state them here and verify the
 * disjointness + casing invariants directly.
 */
import test from "node:test";
import assert from "node:assert/strict";

// Sets duplicated from app/api/twilio/inbound/route.ts. If this drifts,
// the route should always be the source of truth — these tests are the
// safety net.
const STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);
const START_KEYWORDS = new Set(["START", "YES", "UNSTOP"]);
const WHATSAPP_OPT_IN_KEYWORDS = new Set([
  "WHATSAPP",
  "WHATSAPP YES",
  "WA YES",
  "WAYES",
  "WA",
]);
const WHATSAPP_OPT_OUT_KEYWORDS = new Set([
  "WHATSAPP STOP",
  "WHATSAPP NO",
  "WA STOP",
  "WA NO",
  "WANO",
]);

function normalize(body: string): string {
  return body.trim().toUpperCase();
}

test("STOP / START / WhatsApp sets do not overlap — a keyword can only mean one thing", () => {
  const allSets = [
    { name: "STOP", set: STOP_KEYWORDS },
    { name: "START", set: START_KEYWORDS },
    { name: "WHATSAPP_OPT_IN", set: WHATSAPP_OPT_IN_KEYWORDS },
    { name: "WHATSAPP_OPT_OUT", set: WHATSAPP_OPT_OUT_KEYWORDS },
  ];
  for (let i = 0; i < allSets.length; i += 1) {
    for (let j = i + 1; j < allSets.length; j += 1) {
      for (const keyword of allSets[i].set) {
        assert.ok(
          !allSets[j].set.has(keyword),
          `keyword "${keyword}" appears in both ${allSets[i].name} and ${allSets[j].name}`,
        );
      }
    }
  }
});

test("Customer texting WHATSAPP opts into WhatsApp without affecting SMS", () => {
  const body = normalize("Whatsapp");
  assert.ok(WHATSAPP_OPT_IN_KEYWORDS.has(body));
  assert.ok(!STOP_KEYWORDS.has(body));
  assert.ok(!START_KEYWORDS.has(body));
});

test("Customer texting YES means SMS opt-in (not WhatsApp)", () => {
  const body = normalize("yes");
  assert.ok(START_KEYWORDS.has(body));
  assert.ok(!WHATSAPP_OPT_IN_KEYWORDS.has(body));
});

test("Customer texting STOP unsubscribes from SMS (not WhatsApp)", () => {
  const body = normalize("Stop");
  assert.ok(STOP_KEYWORDS.has(body));
  assert.ok(!WHATSAPP_OPT_OUT_KEYWORDS.has(body));
});

test("Customer texting WA STOP opts out of WhatsApp without affecting SMS", () => {
  const body = normalize("wa stop");
  assert.ok(WHATSAPP_OPT_OUT_KEYWORDS.has(body));
  assert.ok(!STOP_KEYWORDS.has(body));
});

test("Whitespace variants normalize correctly", () => {
  assert.ok(WHATSAPP_OPT_IN_KEYWORDS.has(normalize("  whatsapp  ")));
  assert.ok(WHATSAPP_OPT_IN_KEYWORDS.has(normalize("Wa Yes")));
  assert.ok(WHATSAPP_OPT_OUT_KEYWORDS.has(normalize("WANO")));
});

test("Casual / unrelated words don't match anything", () => {
  for (const phrase of ["thanks", "hello", "great", "tomorrow", ""]) {
    const body = normalize(phrase);
    assert.ok(!STOP_KEYWORDS.has(body));
    assert.ok(!START_KEYWORDS.has(body));
    assert.ok(!WHATSAPP_OPT_IN_KEYWORDS.has(body));
    assert.ok(!WHATSAPP_OPT_OUT_KEYWORDS.has(body));
  }
});

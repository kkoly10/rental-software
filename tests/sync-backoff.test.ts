/**
 * Sprint 5.10 — Exponential backoff for accounting-sync retries.
 *
 * The pure function `shouldSkipSyncForBackoff` is what gates the
 * QBO + Xero reconcile crons. A regression in this function means
 * either:
 *   - the cron pounds Intuit / Xero for orders that will never sync
 *     (backoff broken)
 *   - the cron silently abandons orders before max attempts (cap
 *     broken)
 *   - operators see orders skipped on the first attempt (initial
 *     "never attempted" case broken)
 *
 * Pinning the table of (attempts, hours since last attempt) → skip
 * decision so any future tweak to the backoff curve is visible in
 * the diff.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SYNC_ATTEMPTS,
  shouldSkipSyncForBackoff,
} from "../lib/integrations/sync-backoff.ts";

const NOW = new Date("2026-06-04T12:00:00Z").getTime();

function hoursAgo(h: number): string {
  return new Date(NOW - h * 60 * 60 * 1000).toISOString();
}

test("never-attempted orders run immediately", () => {
  const result = shouldSkipSyncForBackoff(0, null, NOW);
  assert.deepEqual(result, { skip: false });
});

test("never-attempted orders run even when attempts > 0 with null lastAttempt", () => {
  // Defensive: someone increments attempts without writing lastAttempt.
  // We still want to run the sync rather than skip a stuck row forever.
  const result = shouldSkipSyncForBackoff(3, null, NOW);
  assert.deepEqual(result, { skip: false });
});

test("first retry backs off 1 hour", () => {
  // 30 minutes after last attempt — skip
  let r = shouldSkipSyncForBackoff(1, hoursAgo(0.5), NOW);
  assert.equal(r.skip, true);
  if (r.skip) assert.equal(r.reason, "backoff");

  // 2 hours after last attempt — run
  r = shouldSkipSyncForBackoff(1, hoursAgo(2), NOW);
  assert.equal(r.skip, false);
});

test("backoff curve doubles up to 24h cap", () => {
  // (attempts, hours-back, expected-skip)
  const cases: Array<[number, number, boolean]> = [
    [2, 1.5, true],   // 2h backoff, only 1.5h passed
    [2, 2.5, false],  // 2h backoff, 2.5h passed
    [3, 3, true],     // 4h backoff
    [3, 5, false],
    [4, 7, true],     // 8h backoff
    [4, 9, false],
    [5, 15, true],    // 16h backoff
    [5, 17, false],
    [6, 23, true],    // capped at 24h
    [6, 25, false],
    [9, 23, true],    // still capped at 24h
    [9, 25, false],
  ];
  for (const [attempts, hours, expectedSkip] of cases) {
    const r = shouldSkipSyncForBackoff(attempts, hoursAgo(hours), NOW);
    assert.equal(
      r.skip,
      expectedSkip,
      `attempts=${attempts}, ${hours}h ago → expected skip=${expectedSkip}, got ${r.skip}`,
    );
  }
});

test(`orders past MAX_SYNC_ATTEMPTS (${MAX_SYNC_ATTEMPTS}) skip forever`, () => {
  // Even with a long time since last attempt, max-attempts wins.
  const r = shouldSkipSyncForBackoff(MAX_SYNC_ATTEMPTS, hoursAgo(1000), NOW);
  assert.equal(r.skip, true);
  if (r.skip) assert.equal(r.reason, "max_attempts");
});

test("max_attempts beats backoff when both would apply", () => {
  // Order tried 11 times, last 30 minutes ago. Backoff would also skip,
  // but the reason returned should be max_attempts so the cron's
  // skippedMaxAttempts counter is accurate.
  const r = shouldSkipSyncForBackoff(MAX_SYNC_ATTEMPTS + 1, hoursAgo(0.5), NOW);
  assert.equal(r.skip, true);
  if (r.skip) assert.equal(r.reason, "max_attempts");
});

test("backoff result includes nextEligibleAt for log/UI use", () => {
  const r = shouldSkipSyncForBackoff(3, hoursAgo(1), NOW);
  assert.equal(r.skip, true);
  if (r.skip && r.reason === "backoff") {
    // attempts=3 → 4h backoff. Last attempt was 1h ago, so 3h remain.
    const expectedNextMs = NOW + 3 * 60 * 60 * 1000;
    assert.equal(r.nextEligibleAt.getTime(), expectedNextMs);
  } else {
    assert.fail("expected backoff skip reason");
  }
});

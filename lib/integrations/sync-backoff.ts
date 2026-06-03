/**
 * Exponential backoff for accounting-sync retries (Sprint 5.10).
 *
 * Before: both `quickbooks-reconcile` and `xero-reconcile` cron jobs
 * retried failed orders every hour with no awareness of how many
 * times we'd tried before. A persistently-failing sync (bad invoice
 * data, revoked permission, Intuit-side issue) would hammer the
 * provider's API every hour forever, racking up rate-limit pressure
 * and noise in the failure logs.
 *
 * Now: the `attempts` column on the sync row drives an exponential
 * backoff window — 1h → 2h → 4h → 8h → 16h → 24h (cap) — and after
 * MAX_SYNC_ATTEMPTS the order is treated as terminally stuck and
 * skipped entirely until an operator clears it manually.
 *
 * Kept as a pure function so the same logic can be unit-tested and
 * reused by any future accounting-sync (Wave, Sage, etc.). Returns a
 * verbose result with the skip reason so the cron can log accurately.
 */

export const MAX_SYNC_ATTEMPTS = 10;

export type SyncSkipDecision =
  | { skip: false }
  | { skip: true; reason: "max_attempts" }
  | { skip: true; reason: "backoff"; nextEligibleAt: Date };

export function shouldSkipSyncForBackoff(
  attempts: number,
  lastAttempt: string | null | undefined,
  now: number = Date.now(),
): SyncSkipDecision {
  // Stop trying after MAX_SYNC_ATTEMPTS. Surfacing the order to the
  // operator (e.g. as a "stuck" badge on Settings → Integrations) is
  // a follow-up — for now the cron silently drops it so it doesn't
  // burn API quota indefinitely.
  if (attempts >= MAX_SYNC_ATTEMPTS) {
    return { skip: true, reason: "max_attempts" };
  }

  // Never attempted yet — run immediately.
  if (!lastAttempt) {
    return { skip: false };
  }

  // 2^(attempts - 1) hours, capped at 24. attempts=1 → 1h, =2 → 2h,
  // =3 → 4h, =4 → 8h, =5 → 16h, =6+ → 24h. The Math.max guards
  // against attempts=0 (which the !lastAttempt branch already
  // caught, but defensively).
  const backoffHours = Math.min(
    24,
    Math.pow(2, Math.max(0, Math.min(attempts - 1, 6))),
  );
  const backoffMs = backoffHours * 60 * 60 * 1000;
  const lastMs = new Date(lastAttempt).getTime();
  if (lastMs + backoffMs > now) {
    return {
      skip: true,
      reason: "backoff",
      nextEligibleAt: new Date(lastMs + backoffMs),
    };
  }

  return { skip: false };
}

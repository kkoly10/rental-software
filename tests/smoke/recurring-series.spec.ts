/**
 * Sprint 3 — recurring series HTTP smoke
 *
 * Verifies the daily expansion cron is properly gated and the
 * orders page that hosts the new MakeRecurringForm + SeriesInfoCard
 * doesn't crash under the unauthed-render path.
 *
 * What this does NOT cover (requires authed Supabase):
 *   - End-to-end "make recurring → 12 children appear" Playwright walk
 *   - Series cancellation chain
 *   - The pause / resume round-trip
 *
 * Those are unit-tested via the fake-Supabase pattern OR live as
 * manual sandbox steps once an internal demo org is wired.
 */
import { test, expect } from "@playwright/test";

test.describe("Recurring series surfaces", () => {
  test("/api/cron/expand-recurring-series requires cron secret", async ({ request }) => {
    const res = await request.get("/api/cron/expand-recurring-series");
    // 403 forbidden without the secret, or 503 if Supabase isn't
    // configured. Critical: never 200 without the secret — that would
    // expose the cron to any drive-by visitor.
    expect([401, 403, 503], `unexpected status: ${res.status()}`).toContain(res.status());
  });

  test("/dashboard/orders/[id] still renders (regression for the new card mounts)", async ({
    request,
  }) => {
    const res = await request.get(
      "/dashboard/orders/00000000-0000-0000-0000-000000000000",
      { maxRedirects: 0 },
    );
    // Auth wall, demo render, or 404 — anything < 500.
    expect(res.status(), `unexpected status ${res.status()}`).toBeLessThan(500);
  });
});

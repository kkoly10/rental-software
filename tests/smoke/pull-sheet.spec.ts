/**
 * Smoke tests for the pull-sheet PDF API route.
 *
 * GET /api/deliveries/[id]/pull-sheet should:
 *   - Require authentication (401 for unauth requests)
 *   - Return 404 for an unknown route id (not 500)
 *   - Return a PDF (Content-Type) for a valid auth+route combo
 *
 * The third case requires a logged-in operator and a real route; in CI
 * we exercise the first two cases via the public API surface and rely
 * on the operator-walkthrough Playwright suite to confirm the full
 * browser flow end-to-end.
 */
import { test, expect } from "@playwright/test";

const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

test.describe("GET /api/deliveries/[id]/pull-sheet", () => {
  test("returns 401 (or 503) when unauthenticated", async ({ request }) => {
    const res = await request.get(`/api/deliveries/${FAKE_UUID}/pull-sheet`);
    // 401 when Supabase is wired; 503 in the "Not configured" fallback.
    expect([401, 503], `unexpected status: ${res.status()}`).toContain(res.status());
  });

  test("does not crash on a non-uuid path segment", async ({ request }) => {
    const res = await request.get("/api/deliveries/not-a-uuid/pull-sheet");
    // Either auth blocks us first (401/503) or the route query returns
    // 404 — what we care about is that no 500 leaks through.
    expect(res.status(), `unexpected status: ${res.status()}`).toBeLessThan(500);
  });
});

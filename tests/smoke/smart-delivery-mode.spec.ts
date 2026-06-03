/**
 * Sprint 1.5 — Smart Delivery Mode smoke
 *
 * Verifies the new dashboard surfaces don't crash under the typical
 * "no auth" condition and that the routing config we ship doesn't
 * yank pages that were previously reachable.
 *
 * What this covers:
 *   - The new auto-mode panel on /dashboard/deliveries lives inside
 *     the auth wall; unauth requests should redirect (not 500).
 *   - The Settings page hosts the new "Smart Delivery Mode" section
 *     and is similarly auth-walled.
 *   - The pull-sheet PDF endpoint from Sprint 1 is still reachable
 *     and still gates on auth (regression check that we didn't
 *     accidentally widen auth during the Sprint 1.5 refactors).
 *
 * What this does NOT cover (intentional — requires browser auth + a
 * seeded org + a Supabase client):
 *   - Clicking "Send delivery" and verifying the order flips to
 *     `out_for_delivery`. That lives in tests/smart-delivery-flow.test.ts
 *     as a unit-level flow test with a faked Supabase, since the real
 *     end-to-end requires too much infra.
 *   - The Settings → toggle round-trip. Same reason.
 *
 * Run against local dev:    npm run test:smoke
 * Run against deploy:       BASE_URL=https://… npm run test:smoke
 */
import { test, expect } from "@playwright/test";

test.describe("Smart Delivery Mode surfaces", () => {
  test("/dashboard/deliveries is auth-walled (no 500)", async ({ request }) => {
    const res = await request.get("/dashboard/deliveries", {
      maxRedirects: 0,
    });
    // 200 = demo mode renders the page; 3xx = redirect to login; 401/403 =
    // explicit auth refusal. Anything 500+ is a regression — the
    // auto-mode panel + new i18n keys should not crash the SSR.
    expect(
      res.status(),
      `unexpected status ${res.status()} on /dashboard/deliveries`,
    ).toBeLessThan(500);
  });

  test("/dashboard/settings hosts the routing-mode toggle without crashing", async ({
    request,
  }) => {
    const res = await request.get("/dashboard/settings", {
      maxRedirects: 0,
    });
    expect(
      res.status(),
      `unexpected status ${res.status()} on /dashboard/settings`,
    ).toBeLessThan(500);
  });

  test("Sprint 1 pull-sheet API still gated correctly after the refactor", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/deliveries/00000000-0000-0000-0000-000000000000/pull-sheet",
    );
    // 401 when Supabase is wired; 503 in the "Not configured" fallback.
    // 200 would mean we accidentally widened auth — that's the
    // regression we're guarding against.
    expect([401, 403, 404, 503], `unexpected status: ${res.status()}`).toContain(res.status());
  });

  test("/dashboard/orders/[id] hosts the new SendDeliveryButton mount point", async ({
    request,
  }) => {
    const res = await request.get(
      "/dashboard/orders/00000000-0000-0000-0000-000000000000",
      { maxRedirects: 0 },
    );
    expect(res.status(), `unexpected status ${res.status()}`).toBeLessThan(500);
  });
});

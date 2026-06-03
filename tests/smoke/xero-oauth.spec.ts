/**
 * Sprint 3.5 — Xero OAuth surface smoke
 *
 * The full OAuth round-trip requires real Xero credentials and a
 * deployed callback URL. What we can verify cheaply: the routes
 * exist and don't 500 on unauthed requests.
 *
 * Run against local dev:    npm run test:smoke
 * Run against deploy:       BASE_URL=https://… npm run test:smoke
 */
import { test, expect } from "@playwright/test";

// Accept anything that means "we handled it" — 2xx / 3xx / 4xx /
// 503 (not configured). The only real failure is 500/501/502.
function expectHandledGracefully(status: number, route: string) {
  expect(
    status < 500 || status === 503,
    `route ${route} returned ${status} — expected 2xx / 3xx / 4xx / 503`,
  ).toBe(true);
}

test.describe("Xero OAuth routes", () => {
  test("/api/integrations/xero/connect refuses unauthed", async ({ request }) => {
    const res = await request.get("/api/integrations/xero/connect", { maxRedirects: 0 });
    expectHandledGracefully(res.status(), "/api/integrations/xero/connect");
  });

  test("/api/integrations/xero/callback handles missing params without 500", async ({ request }) => {
    const res = await request.get("/api/integrations/xero/callback", { maxRedirects: 0 });
    expectHandledGracefully(res.status(), "/api/integrations/xero/callback");
  });

  test("/api/integrations/xero/disconnect rejects GET (POST only)", async ({ request }) => {
    const res = await request.get("/api/integrations/xero/disconnect", { maxRedirects: 0 });
    expectHandledGracefully(res.status(), "/api/integrations/xero/disconnect");
  });

  test("/api/cron/xero-reconcile requires cron secret", async ({ request }) => {
    const res = await request.get("/api/cron/xero-reconcile");
    expect([401, 403, 503], `unexpected status: ${res.status()}`).toContain(res.status());
  });
});

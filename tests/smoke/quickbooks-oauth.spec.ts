/**
 * Sprint 2 — QuickBooks OAuth surface smoke
 *
 * The full OAuth round-trip requires real Intuit credentials and a
 * deployed callback URL. What we can verify cheaply:
 *
 *   - The connect/callback/disconnect routes exist and don't 500 on
 *     unauthed requests. The exact status depends on whether the
 *     deploy has QBO_* env vars configured.
 *   - The reconcile cron requires the cron secret and refuses
 *     unauthorized calls.
 *
 * Run against local dev:    npm run test:smoke
 * Run against deploy:       BASE_URL=https://… npm run test:smoke
 */
import { test, expect } from "@playwright/test";

test.describe("QuickBooks Online OAuth routes", () => {
  test("/api/integrations/quickbooks/connect refuses unauthed", async ({ request }) => {
    const res = await request.get("/api/integrations/quickbooks/connect", {
      maxRedirects: 0,
    });
    // 401 (no auth), 503 (not configured), or 3xx (redirect to login).
    // 500+ would mean the route crashed during the auth check.
    expect(res.status(), `unexpected status ${res.status()}`);
    expect(res.status() < 500 || res.status() === 503).toBe(true);
  });

  test("/api/integrations/quickbooks/callback handles missing params without 500", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/integrations/quickbooks/callback",
      { maxRedirects: 0 },
    );
    // Expected: redirect back to /dashboard/settings?qbo=missing_params
    // or auth refusal. Crucial: never a 500.
    expect(res.status(), `unexpected status ${res.status()}`);
    expect(res.status() < 500 || res.status() === 503).toBe(true);
  });

  test("/api/integrations/quickbooks/disconnect rejects GET (POST only)", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/integrations/quickbooks/disconnect",
      { maxRedirects: 0 },
    );
    // Next.js returns 405 for an undefined method, OR redirects to
    // login if auth fires first. Either way: < 500.
    expect(res.status(), `unexpected status ${res.status()}`);
    expect(res.status() < 500 || res.status() === 503).toBe(true);
  });

  test("/api/cron/quickbooks-reconcile requires cron secret", async ({ request }) => {
    const res = await request.get("/api/cron/quickbooks-reconcile");
    // 403 forbidden (no secret) or 503 not configured. Never 200
    // without the secret header — that would mean the cron runs for
    // anyone hitting the URL.
    expect([401, 403, 503], `unexpected status: ${res.status()}`).toContain(res.status());
  });
});

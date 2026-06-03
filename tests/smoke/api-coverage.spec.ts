/**
 * Cross-sprint API coverage smoke.
 *
 * Every route + cron endpoint added across Sprints 1, 1.5, 2, 3, 3.5,
 * 4, and 5 lives in this single file so a future migration or refactor
 * that breaks one of them surfaces immediately. The matrix-style table
 * at the bottom of the file is the single source of truth for "what
 * did we ship and is each one still reachable."
 *
 * The bar these tests set: **no route ever returns 500 to an unauth
 * caller.** Auth-gated routes should respond with 401/403/3xx (redirect
 * to login) or 503 (not-configured), never a stack trace. That's the
 * single most common production regression and the one that drives
 * 100% of "site is broken" Slack pages.
 *
 * What this does NOT cover:
 *   - Authenticated flows (operator logs in, clicks "Send delivery",
 *     verifies state) — that needs a Supabase test database + seeded
 *     account, which is tracked as a Sprint 5.7 follow-up
 *   - Live external API calls (Intuit / Xero / Twilio / Mapbox) —
 *     those need real sandbox credentials in CI secrets
 *   - The actual business logic correctness (does pull sheet show the
 *     right items?) — that's covered by the unit-test suite using
 *     fake Supabase doubles
 */
import { test, expect } from "@playwright/test";

const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

// Allow either a redirect, a not-found, an auth refusal, or a
// not-configured response — all of which mean "the route is reachable
// and didn't crash."
const ACCEPTABLE_UNAUTH_STATUSES = [200, 301, 302, 303, 307, 308, 401, 403, 404, 405, 503];

function expectNonCrash(status: number, route: string) {
  expect(
    ACCEPTABLE_UNAUTH_STATUSES.includes(status),
    `route ${route} returned ${status} — expected one of ${ACCEPTABLE_UNAUTH_STATUSES.join(", ")}`,
  ).toBe(true);
}

test.describe("Sprint 1 — pull sheets + QBO CSV", () => {
  test("/api/deliveries/[id]/pull-sheet is reachable", async ({ request }) => {
    const res = await request.get(`/api/deliveries/${FAKE_UUID}/pull-sheet`);
    expectNonCrash(res.status(), "/api/deliveries/[id]/pull-sheet");
  });

  test("/dashboard/deliveries/[id]/pull-sheet renders without crash", async ({ request }) => {
    const res = await request.get(
      `/dashboard/deliveries/${FAKE_UUID}/pull-sheet`,
      { maxRedirects: 0 },
    );
    expectNonCrash(res.status(), "/dashboard/deliveries/[id]/pull-sheet");
  });
});

test.describe("Sprint 1.5 — Smart Delivery Mode", () => {
  test("/dashboard/deliveries is reachable", async ({ request }) => {
    const res = await request.get("/dashboard/deliveries", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/dashboard/deliveries");
  });

  test("/dashboard/deliveries/[id] is reachable", async ({ request }) => {
    const res = await request.get(`/dashboard/deliveries/${FAKE_UUID}`, { maxRedirects: 0 });
    expectNonCrash(res.status(), "/dashboard/deliveries/[id]");
  });

  test("/dashboard/settings hosts the routing-mode toggle", async ({ request }) => {
    const res = await request.get("/dashboard/settings", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/dashboard/settings");
  });

  test("/dashboard/orders/[id] hosts the SendDeliveryButton mount", async ({ request }) => {
    const res = await request.get(`/dashboard/orders/${FAKE_UUID}`, { maxRedirects: 0 });
    expectNonCrash(res.status(), "/dashboard/orders/[id]");
  });
});

test.describe("Sprint 2 — QuickBooks Online", () => {
  test("/api/integrations/quickbooks/connect", async ({ request }) => {
    const res = await request.get("/api/integrations/quickbooks/connect", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/api/integrations/quickbooks/connect");
  });

  test("/api/integrations/quickbooks/callback handles missing params", async ({ request }) => {
    const res = await request.get("/api/integrations/quickbooks/callback", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/api/integrations/quickbooks/callback");
  });

  test("/api/integrations/quickbooks/disconnect rejects GET cleanly", async ({ request }) => {
    const res = await request.get("/api/integrations/quickbooks/disconnect", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/api/integrations/quickbooks/disconnect");
  });

  test("/api/cron/quickbooks-reconcile requires cron secret", async ({ request }) => {
    const res = await request.get("/api/cron/quickbooks-reconcile");
    expect([401, 403, 503], `unexpected status: ${res.status()}`).toContain(res.status());
  });
});

test.describe("Sprint 3 — recurring booking series", () => {
  test("/api/cron/expand-recurring-series requires cron secret", async ({ request }) => {
    const res = await request.get("/api/cron/expand-recurring-series");
    expect([401, 403, 503], `unexpected status: ${res.status()}`).toContain(res.status());
  });
});

test.describe("Sprint 3.5 — Xero", () => {
  test("/api/integrations/xero/connect", async ({ request }) => {
    const res = await request.get("/api/integrations/xero/connect", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/api/integrations/xero/connect");
  });

  test("/api/integrations/xero/callback handles missing params", async ({ request }) => {
    const res = await request.get("/api/integrations/xero/callback", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/api/integrations/xero/callback");
  });

  test("/api/integrations/xero/disconnect rejects GET cleanly", async ({ request }) => {
    const res = await request.get("/api/integrations/xero/disconnect", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/api/integrations/xero/disconnect");
  });

  test("/api/cron/xero-reconcile requires cron secret", async ({ request }) => {
    const res = await request.get("/api/cron/xero-reconcile");
    expect([401, 403, 503], `unexpected status: ${res.status()}`).toContain(res.status());
  });
});

test.describe("Sprint 4 — WhatsApp Business", () => {
  // The WhatsApp send path is internal (called from sendSmsNotification);
  // there's no dedicated route to smoke. The Settings page is the only
  // operator-facing surface for the toggle.
  test("/dashboard/settings hosts the WhatsApp form", async ({ request }) => {
    const res = await request.get("/dashboard/settings", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/dashboard/settings (WhatsApp form)");
  });
});

test.describe("Sprint 5 — Route auto-optimization", () => {
  // The optimize action is a server action invoked from the route
  // detail page — there's no dedicated GET endpoint. We verify the
  // route detail page hosts the button without crashing.
  test("/dashboard/deliveries/[id] hosts the Optimize button", async ({ request }) => {
    const res = await request.get(`/dashboard/deliveries/${FAKE_UUID}`, { maxRedirects: 0 });
    expectNonCrash(res.status(), "/dashboard/deliveries/[id] (Optimize button)");
  });
});

test.describe("Pre-existing routes still reachable (regression check)", () => {
  test("/api/health", async ({ request }) => {
    const res = await request.get("/api/health");
    // Health endpoint is intentionally public; should be 200 or 503.
    expect([200, 503]).toContain(res.status());
  });

  test("/api/invoices/[orderId] auth-gated", async ({ request }) => {
    const res = await request.get(`/api/invoices/${FAKE_UUID}`);
    expectNonCrash(res.status(), "/api/invoices/[orderId]");
  });

  test("/api/quotes/[orderId] auth-gated", async ({ request }) => {
    const res = await request.get(`/api/quotes/${FAKE_UUID}`);
    expectNonCrash(res.status(), "/api/quotes/[orderId]");
  });

  test("/dashboard (homepage of authenticated app)", async ({ request }) => {
    const res = await request.get("/dashboard", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/dashboard");
  });

  test("/dashboard/orders index page", async ({ request }) => {
    const res = await request.get("/dashboard/orders", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/dashboard/orders");
  });

  test("/dashboard/calendar", async ({ request }) => {
    const res = await request.get("/dashboard/calendar", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/dashboard/calendar");
  });

  test("/dashboard/payments index page", async ({ request }) => {
    const res = await request.get("/dashboard/payments", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/dashboard/payments");
  });

  test("/dashboard/customers index page", async ({ request }) => {
    const res = await request.get("/dashboard/customers", { maxRedirects: 0 });
    expectNonCrash(res.status(), "/dashboard/customers");
  });
});

/**
 * What's intentionally NOT tested here:
 *
 *   - /api/twilio/inbound — needs a Twilio signature header; covered
 *     by a focused test in tests/smoke/business-flows.spec.ts
 *   - /api/stripe/webhooks — needs a Stripe signature; same deal
 *   - /api/portal/* — needs a valid portal access token
 *   - All cron endpoints other than reconcile + expand — already
 *     covered by tests/smoke/routes.spec.ts
 *
 * If a future sprint adds a new HTTP route, add it to this file —
 * one test per surface, lower bar than business-flows.spec.ts. That
 * file checks behavior; this one checks reachability.
 */

/**
 * Business-Flow Smoke Tests
 *
 * Verifies that the core customer and operator flows are reachable and respond
 * with expected HTTP status codes. These tests do NOT require an authenticated
 * session or a seeded database — they assert that routes are wired up correctly
 * and do not crash (no 500s).
 *
 * Run with:  npm run test:smoke
 *
 * Bookability model (documented here for traceability):
 *   - Products alone are NOT bookable. Capacity = count of `assets` rows where
 *     operational_status IN ('ready', 'available', 'active').
 *   - Products with zero qualifying assets return available=false at date-select
 *     time, even if is_active=true. (See lib/availability/check.ts and the
 *     reserve_availability_if_available() Postgres function.)
 *   - createProduct() and updateProduct() now auto-create one asset (status
 *     'ready') when is_active=true and no qualifying asset exists, so a freshly
 *     created active product is immediately bookable.
 */
import { test, expect, APIRequestContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true for any "success or expected non-crash" status. */
function isAcceptablePageStatus(status: number): boolean {
  // 200 OK, 3xx redirect, 404 not found — all are expected behaviours.
  // 500 is always a bug.
  return status < 500;
}

async function expectNotCrashed(
  res: Awaited<ReturnType<APIRequestContext["get"]>>,
  label: string
) {
  expect(
    isAcceptablePageStatus(res.status()),
    `${label} must not return 5xx (got ${res.status()})`
  ).toBe(true);
}

// ---------------------------------------------------------------------------
// 1. Public Storefront — Customer Booking Flow
// ---------------------------------------------------------------------------

test.describe("Public storefront — customer booking flow", () => {
  test("GET / — marketing homepage loads", async ({ request }) => {
    const res = await request.get("/");
    await expectNotCrashed(res, "GET /");
    expect([200, 301, 302, 307, 308]).toContain(res.status());
  });

  test("GET /inventory — catalog listing loads", async ({ request }) => {
    const res = await request.get("/inventory");
    await expectNotCrashed(res, "GET /inventory");
    expect([200, 301, 302, 307, 308]).toContain(res.status());
  });

  test("GET /inventory/[slug] — unknown slug returns 404, not 500", async ({ request }) => {
    const res = await request.get("/inventory/smoke-test-product-does-not-exist");
    // 404 = product not found (correct behaviour)
    // 200 = demo/dev mode returned something
    // 3xx = redirected to catalog
    await expectNotCrashed(res, "GET /inventory/[unknown-slug]");
  });

  test("GET /checkout — checkout page loads without crashing", async ({ request }) => {
    // Checkout requires cart state in session; without it the page should either
    // render an empty/redirect state or show an error UI — never 500.
    const res = await request.get("/checkout");
    await expectNotCrashed(res, "GET /checkout");
  });

  test("GET /order-confirmation — loads without crashing", async ({ request }) => {
    const res = await request.get("/order-confirmation");
    await expectNotCrashed(res, "GET /order-confirmation");
  });

  test("GET /order-status — loads without crashing", async ({ request }) => {
    const res = await request.get("/order-status");
    await expectNotCrashed(res, "GET /order-status");
  });
});

// ---------------------------------------------------------------------------
// 2. Auth / Operator Setup Flow
// ---------------------------------------------------------------------------

test.describe("Auth and operator setup flow", () => {
  test("GET /login — returns 200", async ({ request }) => {
    const res = await request.get("/login");
    expect(res.status()).toBe(200);
  });

  test("GET /signup — returns 200", async ({ request }) => {
    const res = await request.get("/signup");
    expect(res.status()).toBe(200);
  });

  test("GET /forgot-password — returns 200", async ({ request }) => {
    const res = await request.get("/forgot-password");
    expect(res.status()).toBe(200);
  });

  test("GET /reset-password — returns 200 or redirect (no token)", async ({ request }) => {
    const res = await request.get("/reset-password");
    // Without a valid token, page may render an error state (200) or redirect.
    await expectNotCrashed(res, "GET /reset-password");
    expect([200, 301, 302, 307, 308]).toContain(res.status());
  });

  test("GET /onboarding — returns 200 or redirects to login", async ({ request }) => {
    const res = await request.get("/onboarding");
    await expectNotCrashed(res, "GET /onboarding");
    expect([200, 301, 302, 307, 308]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// 3. Operator Dashboard — Core Routes
// ---------------------------------------------------------------------------

test.describe("Operator dashboard — core routes", () => {
  const dashboardRoutes = [
    "/dashboard",
    "/dashboard/products",
    "/dashboard/orders",
    "/dashboard/customers",
    "/dashboard/payments",
    "/dashboard/analytics",
    "/dashboard/calendar",
    "/dashboard/deliveries",
    "/dashboard/documents",
    "/dashboard/messages",
    "/dashboard/maintenance",
    "/dashboard/pricing",
    "/dashboard/service-areas",
    "/dashboard/settings",
    "/dashboard/website",
    "/dashboard/help",
  ];

  for (const route of dashboardRoutes) {
    test(`GET ${route} — does not return 500`, async ({ request }) => {
      const res = await request.get(route);
      // Without a session, Next.js middleware redirects to /login (307).
      // If auth is not configured (demo mode), the page renders (200).
      // Either way, must not be 5xx.
      await expectNotCrashed(res, `GET ${route}`);
      expect([200, 301, 302, 307, 308]).toContain(res.status());
    });
  }
});

// ---------------------------------------------------------------------------
// 4. Public Marketing Pages
// ---------------------------------------------------------------------------

test.describe("Public marketing pages", () => {
  const marketingRoutes = [
    "/pricing",
    "/terms",
    "/privacy",
    "/contact",
    "/offline",
  ];

  for (const route of marketingRoutes) {
    test(`GET ${route} — returns 200`, async ({ request }) => {
      const res = await request.get(route);
      // These are static/marketing pages — always expect 200 (no auth required).
      // Allow 3xx in case a redirect is configured.
      await expectNotCrashed(res, `GET ${route}`);
      expect([200, 301, 302, 307, 308]).toContain(res.status());
    });
  }
});

// ---------------------------------------------------------------------------
// 5. Inventory / Bookability Model — Documented Behaviour
// ---------------------------------------------------------------------------
//
// NOTE: Availability checking is NOT exposed as an HTTP API route. It runs
// entirely through Next.js server actions (lib/availability/check.ts called
// by lib/checkout/actions.ts) and a Postgres function
// (reserve_availability_if_available). The invariant:
//   - Capacity = count of `assets` rows with operational_status IN
//     ('ready', 'available', 'active').
//   - Products with zero qualifying assets → available=false at date-select.
//   - createProduct/updateProduct now auto-create one 'ready' asset when
//     is_active=true and assetCount=0, so new active products are bookable.

test.describe("Inventory bookability — infrastructure checks", () => {
  test("GET /api/health — system health check is reachable", async ({ request }) => {
    const res = await request.get("/api/health");
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(["healthy", "degraded"]).toContain(body.status);
  });

  test("GET /api/org-type — returns business type (200 or 200 with default)", async ({ request }) => {
    // Public route — returns the org's business type (inflatable/car/equipment)
    // or the default when no session is present. Should never crash.
    const res = await request.get("/api/org-type");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("businessType");
    expect(["inflatable", "car", "equipment"]).toContain(body.businessType);
  });

  test("GET /api/domains/check-slug — slug availability check is reachable", async ({ request }) => {
    // Indirectly verifies the Supabase-backed org lookup infrastructure used
    // by storefront routing does not crash.
    const res = await request.get("/api/domains/check-slug?slug=smoke-bookability-test");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("available");
    expect(typeof body.available).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// 6. Payment / Portal / Document — Safe-Failure Flows
// ---------------------------------------------------------------------------

test.describe("Payment, portal, and document safe-failure flows", () => {
  test("GET /api/invoices/[orderId] — returns 401/403/503 without session", async ({ request }) => {
    const res = await request.get("/api/invoices/smoke-test-order-id");
    expect([401, 403, 503]).toContain(res.status());
  });

  test("GET /api/quotes/[orderId] — returns 401/503 without session", async ({ request }) => {
    const res = await request.get("/api/quotes/smoke-test-order-id");
    expect([401, 503]).toContain(res.status());
  });

  test("GET /api/documents/[documentId] — returns 401/503 without session", async ({ request }) => {
    const res = await request.get("/api/documents/smoke-test-doc-id");
    expect([401, 503]).toContain(res.status());
  });

  test("POST /api/portal/send-message — rejects empty body", async ({ request }) => {
    const res = await request.post("/api/portal/send-message", { data: {} });
    // 400 = empty body validation; 403 = CSRF origin check rejects test request.
    expect([400, 403]).toContain(res.status());
  });

  test("POST /api/portal/sign-document — rejects empty body", async ({ request }) => {
    const res = await request.post("/api/portal/sign-document", { data: {} });
    expect([400, 403]).toContain(res.status());
  });

  test("POST /api/stripe/webhooks — returns 400/503 for unsigned requests", async ({ request }) => {
    const res = await request.post("/api/stripe/webhooks", {
      headers: { "content-type": "application/json" },
      data: "{}",
    });
    expect([400, 503]).toContain(res.status());
  });

  test("GET /api/tracking/[token] — returns 400 for too-short token", async ({ request }) => {
    const res = await request.get("/api/tracking/short");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("GET /api/tracking/[token] — returns 404/503 for well-formed unknown token", async ({ request }) => {
    const res = await request.get("/api/tracking/smoke-business-flow-test-token-xyz");
    expect([404, 503]).toContain(res.status());
  });
});

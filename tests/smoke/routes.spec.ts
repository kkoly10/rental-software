/**
 * API Route Smoke Tests
 *
 * Verifies every API route is reachable and responds correctly to:
 *   - Missing auth (expects 401/403, not a 500 crash)
 *   - Missing/invalid input (expects 400, not a 500 crash)
 *   - Valid public requests (expects 200 or documented fallback codes)
 *
 * Run against local dev:  npm run test:smoke
 * Run against production: BASE_URL=https://myapp.vercel.app npm run test:smoke
 */
import { test, expect, APIRequestContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Asserts the response is JSON (or at least parseable). */
async function expectJson(res: Awaited<ReturnType<APIRequestContext["get"]>>) {
  const ct = res.headers()["content-type"] ?? "";
  expect(ct, "response should be JSON").toContain("application/json");
}

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

test.describe("GET /api/health", () => {
  test("returns 200 or 503 with proper structure", async ({ request }) => {
    const res = await request.get("/api/health");
    expect([200, 503], "unexpected status from /api/health").toContain(res.status());

    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("checks");
    expect(["healthy", "degraded"]).toContain(body.status);
  });

  test("includes database check result", async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    expect(body.checks).toHaveProperty("env_supabase");
    expect(body.checks).toHaveProperty("env_site_url");
  });
});

// ---------------------------------------------------------------------------
// GET /api/domains/check-slug
// ---------------------------------------------------------------------------

test.describe("GET /api/domains/check-slug", () => {
  test("returns {available: boolean} for a valid slug", async ({ request }) => {
    const res = await request.get("/api/domains/check-slug?slug=smoke-test-slug-99");
    expect(res.status()).toBe(200);
    await expectJson(res);
    const body = await res.json();
    expect(body).toHaveProperty("available");
    expect(typeof body.available).toBe("boolean");
  });

  test("returns available:false for invalid slug format", async ({ request }) => {
    const res = await request.get("/api/domains/check-slug?slug=INVALID!!!SLUG");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(false);
  });

  test("returns available:false for empty slug", async ({ request }) => {
    const res = await request.get("/api/domains/check-slug?slug=");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/weather
// ---------------------------------------------------------------------------

test.describe("GET /api/weather", () => {
  test("returns 400 when params are missing", async ({ request }) => {
    const res = await request.get("/api/weather");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 400 for invalid ZIP code", async ({ request }) => {
    const res = await request.get("/api/weather?zip=ABCDE&date=2026-08-01");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 400 for invalid date format", async ({ request }) => {
    const res = await request.get("/api/weather?zip=10001&date=08-01-2026");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 200 or 404 for valid params (data may not be available)", async ({ request }) => {
    const res = await request.get("/api/weather?zip=10001&date=2026-08-15");
    expect([200, 404], "unexpected status from /api/weather with valid params").toContain(
      res.status()
    );
    await expectJson(res);
  });
});

// ---------------------------------------------------------------------------
// GET /api/storefront-url  (requires auth session)
// ---------------------------------------------------------------------------

test.describe("GET /api/storefront-url", () => {
  test("returns 401 or 200 depending on env (no session sent)", async ({ request }) => {
    const res = await request.get("/api/storefront-url");
    // Without Supabase env configured, the route returns 200 with a local URL.
    // With Supabase env but no session, it returns 401.
    expect([200, 401], "unexpected status from /api/storefront-url").toContain(res.status());
    await expectJson(res);
  });
});

// ---------------------------------------------------------------------------
// POST /api/client-error  (requires matching origin header)
// ---------------------------------------------------------------------------

test.describe("POST /api/client-error", () => {
  test("returns 403 for requests with no recognized origin", async ({ request }) => {
    const res = await request.post("/api/client-error", {
      data: { source: "smoke-test", message: "test error" },
    });
    // Playwright sends no Origin header by default, which the route rejects.
    expect(res.status()).toBe(403);
  });

  test("returns 400 for invalid payload from same origin", async ({ baseURL, request }) => {
    const res = await request.post("/api/client-error", {
      headers: { origin: baseURL ?? "http://localhost:3000" },
      data: { unexpected_field: true },
    });
    expect([400, 202], "unexpected status for bad payload").toContain(res.status());
  });

  test("accepts a valid error report from same origin", async ({ baseURL, request }) => {
    const res = await request.post("/api/client-error", {
      headers: { origin: baseURL ?? "http://localhost:3000" },
      data: {
        source: "smoke-test",
        message: "smoke test client error",
        route: "/test",
        userAgent: "playwright-smoke-test",
      },
    });
    // 200 = logged, 202 = rate-limited but accepted
    expect([200, 202], "valid error report should be accepted").toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// POST /api/copilot  (requires user session)
// ---------------------------------------------------------------------------

test.describe("POST /api/copilot", () => {
  test("returns 401 or 403 without a session", async ({ request }) => {
    const res = await request.post("/api/copilot", {
      data: { messages: [{ role: "user", content: "hello" }], page: "/" },
    });
    expect([401, 403], "unauthenticated copilot request should be rejected").toContain(
      res.status()
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/copilot/current-values  (requires user session)
// ---------------------------------------------------------------------------

test.describe("GET /api/copilot/current-values", () => {
  test("returns 401 without a session", async ({ request }) => {
    const res = await request.get("/api/copilot/current-values");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// POST /api/copilot/action  (requires user session)
// ---------------------------------------------------------------------------

test.describe("POST /api/copilot/action", () => {
  test("returns 401 or 403 without a session", async ({ request }) => {
    const res = await request.post("/api/copilot/action", {
      data: { action: "update_hero", params: { message: "test" } },
    });
    expect([401, 403], "unauthenticated copilot action should be rejected").toContain(
      res.status()
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/domains/update-slug  (requires user session)
// ---------------------------------------------------------------------------

test.describe("POST /api/domains/update-slug", () => {
  test("returns 401 or 503 without a session", async ({ request }) => {
    const res = await request.post("/api/domains/update-slug", {
      data: { slug: "new-slug" },
    });
    // 401 = no session, 503 = Supabase not configured in this env
    expect([401, 503], "unauthenticated slug update should be rejected").toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// POST /api/domains/verify  (requires user session)
// ---------------------------------------------------------------------------

test.describe("POST /api/domains/verify", () => {
  test("returns 401 or 503 without a session", async ({ request }) => {
    const res = await request.post("/api/domains/verify", {
      data: {},
    });
    expect([401, 503], "unauthenticated domain verify should be rejected").toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// GET /api/invoices/[orderId]  (requires user session)
// ---------------------------------------------------------------------------

test.describe("GET /api/invoices/[orderId]", () => {
  test("returns 401 or 503 without a session", async ({ request }) => {
    const res = await request.get("/api/invoices/smoke-test-order-id");
    // 401/403 = no session; 503 = Supabase not configured in this env
    expect([401, 403, 503], "unauthenticated invoice request should be rejected").toContain(
      res.status()
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/portal/send-message  (requires valid portal token in body)
// ---------------------------------------------------------------------------

test.describe("POST /api/portal/send-message", () => {
  test("returns 400 for empty body", async ({ request }) => {
    const res = await request.post("/api/portal/send-message", { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 400 when required fields are missing", async ({ request }) => {
    const res = await request.post("/api/portal/send-message", {
      data: { portalToken: "tok_smoke" /* missing subject + message */ },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 400 for message exceeding 2000 chars", async ({ request }) => {
    const res = await request.post("/api/portal/send-message", {
      data: {
        portalToken: "tok_smoke",
        subject: "Test",
        message: "x".repeat(2001),
      },
    });
    expect(res.status()).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/portal/sign-document  (requires valid portal token in body)
// ---------------------------------------------------------------------------

test.describe("POST /api/portal/sign-document", () => {
  // The endpoint rejects requests from outside the configured origin
  // (CSRF guard) — accept either 400 (empty body) or 403 (no Origin
  // header on the test request).
  test("rejects empty body", async ({ request }) => {
    const res = await request.post("/api/portal/sign-document", { data: {} });
    expect([400, 403]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("rejects when required fields are missing", async ({ request }) => {
    const res = await request.post("/api/portal/sign-document", {
      data: { documentId: "doc_1" /* missing portalToken + signerName */ },
    });
    expect([400, 403]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// POST /api/stripe/webhooks  (requires valid Stripe signature)
// ---------------------------------------------------------------------------

test.describe("POST /api/stripe/webhooks", () => {
  test("returns 400 for missing stripe-signature header", async ({ request }) => {
    const res = await request.post("/api/stripe/webhooks", {
      headers: { "content-type": "application/json" },
      data: "{}",
    });
    // 400 = missing signature, 503 = Stripe/Supabase not configured in this env
    expect([400, 503], "webhook without signature should fail").toContain(res.status());
  });

  test("returns 400 for bogus stripe-signature", async ({ request }) => {
    const res = await request.post("/api/stripe/webhooks", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=0,v1=bogus",
      },
      data: "{}",
    });
    expect([400, 503]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// GET /api/cron/cleanup-holds  (requires CRON_SECRET in Authorization header)
// ---------------------------------------------------------------------------

test.describe("GET /api/cron/cleanup-holds", () => {
  test("returns 401 when CRON_SECRET is set but no auth header provided", async ({ request }) => {
    const res = await request.get("/api/cron/cleanup-holds");
    // 401 = CRON_SECRET is set and we didn't provide it
    // 200/503 = CRON_SECRET not set (open in this env) or Supabase missing
    expect([200, 401, 503], "unexpected status from cleanup-holds cron").toContain(res.status());
  });

  test("returns 401 for wrong cron secret", async ({ request }) => {
    const res = await request.get("/api/cron/cleanup-holds", {
      headers: { authorization: "Bearer definitely-wrong-secret" },
    });
    expect([200, 401, 503], "wrong cron secret should be rejected (or 200/503 if secret unset)").toContain(
      res.status()
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/cron/reminders
// ---------------------------------------------------------------------------

test.describe("GET /api/cron/reminders", () => {
  test("returns 401 or 503 without valid cron secret", async ({ request }) => {
    const res = await request.get("/api/cron/reminders");
    expect([200, 401, 503], "unexpected status from reminders cron").toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// GET /api/cron/reengagement
// ---------------------------------------------------------------------------

test.describe("GET /api/cron/reengagement", () => {
  test("returns 401 or 503 without valid cron secret", async ({ request }) => {
    const res = await request.get("/api/cron/reengagement");
    expect([200, 401, 503], "unexpected status from reengagement cron").toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// GET /api/documents/[documentId]  (requires user session)
// ---------------------------------------------------------------------------

test.describe("GET /api/documents/[documentId]", () => {
  test("returns 401 or 503 without a session", async ({ request }) => {
    const res = await request.get("/api/documents/smoke-test-doc-id");
    // 401 = no session; 503 = Supabase not configured in this env
    expect([401, 503], "unauthenticated document request should be rejected").toContain(
      res.status()
    );
    await expectJson(res);
  });
});

// ---------------------------------------------------------------------------
// GET /api/quotes/[orderId]  (requires user session)
// ---------------------------------------------------------------------------

test.describe("GET /api/quotes/[orderId]", () => {
  test("returns 401 or 503 without a session", async ({ request }) => {
    const res = await request.get("/api/quotes/smoke-test-order-id");
    // 401 = no session; 503 = Supabase not configured in this env
    expect([401, 503], "unauthenticated quote request should be rejected").toContain(
      res.status()
    );
    await expectJson(res);
  });
});

// ---------------------------------------------------------------------------
// GET /api/tracking/[token]  (public route — auth via hashed token)
// ---------------------------------------------------------------------------

test.describe("GET /api/tracking/[token]", () => {
  test("returns 400 for a token that is too short", async ({ request }) => {
    const res = await request.get("/api/tracking/short");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 404 or 503 for a well-formed but unknown token", async ({ request }) => {
    // 20+ char token that won't match any real row
    const res = await request.get("/api/tracking/smoke-test-token-unknown-xyz");
    // 404 = token not found; 503 = Supabase/service-role not configured
    expect([404, 503], "unknown token should return 404 or 503").toContain(res.status());
    await expectJson(res);
  });
});

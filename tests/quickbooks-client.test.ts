/**
 * Tests for the QuickBooks OAuth + API client (Sprint 2).
 *
 * The client wraps Intuit's OAuth + Accounting API behind a typed
 * interface so the rest of the codebase doesn't have to know about
 * `oauth.platform.intuit.com` or the bearer-token dance. These tests
 * pin the pieces we can verify without a real Intuit account:
 *
 *   - URL building (no fetch)
 *   - Token expiry detection (refreshes only when within the leeway)
 *   - 401 retry-with-refresh in qboFetch
 *
 * Live OAuth + sandbox sync is the manual smoke step the operator
 * does after wiring QBO_CLIENT_ID / QBO_CLIENT_SECRET.
 */
import test from "node:test";
import assert from "node:assert/strict";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function withQboEnv<T>(fn: () => Promise<T> | T): Promise<T> | T {
  Object.assign(process.env, {
    QBO_CLIENT_ID: "test_client_id",
    QBO_CLIENT_SECRET: "test_client_secret",
    QBO_REDIRECT_URI: "https://app.example.com/api/integrations/quickbooks/callback",
    QBO_ENVIRONMENT: "sandbox",
  });
  return fn();
}

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  globalThis.fetch = originalFetch;
}

test("buildAuthorizeUrl includes client_id, scope, redirect, state", async () => {
  await withQboEnv(async () => {
    const { buildAuthorizeUrl } = await import("../lib/integrations/quickbooks/client.ts");
    const url = new URL(buildAuthorizeUrl("opaque-csrf-state-123"));

    assert.equal(url.origin + url.pathname, "https://appcenter.intuit.com/connect/oauth2");
    assert.equal(url.searchParams.get("client_id"), "test_client_id");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "https://app.example.com/api/integrations/quickbooks/callback",
    );
    assert.equal(url.searchParams.get("state"), "opaque-csrf-state-123");
    assert.match(url.searchParams.get("scope") ?? "", /com\.intuit\.quickbooks\.accounting/);
    assert.match(url.searchParams.get("scope") ?? "", /openid/);
  });
  restoreEnv();
});

test("buildAuthorizeUrl throws when env is missing", async () => {
  // No env setup — function should reject loudly so we don't silently
  // generate an invalid URL.
  delete process.env.QBO_CLIENT_ID;
  delete process.env.QBO_REDIRECT_URI;
  const { buildAuthorizeUrl } = await import("../lib/integrations/quickbooks/client.ts");
  assert.throws(() => buildAuthorizeUrl("s"), /not configured/);
  restoreEnv();
});

test("ensureFreshTokens returns current tokens when expiry is comfortably far", async () => {
  await withQboEnv(async () => {
    const { ensureFreshTokens } = await import("../lib/integrations/quickbooks/client.ts");
    const result = await ensureFreshTokens({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min out
      refreshTokenExpiresAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      realmId: "realm_1",
    });
    assert.equal(result.refreshed, false);
    assert.equal(result.tokens.accessToken, "a");
  });
  restoreEnv();
});

test("ensureFreshTokens refreshes when access token is within the leeway window", async () => {
  await withQboEnv(async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async (input: unknown) => {
      fetchCalls += 1;
      const url = String(input);
      if (url.includes("tokens/bearer")) {
        return new Response(
          JSON.stringify({
            access_token: "new_access",
            refresh_token: "new_refresh",
            expires_in: 3600,
            x_refresh_token_expires_in: 8640000,
            token_type: "bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("nope", { status: 500 });
    }) as typeof fetch;

    const { ensureFreshTokens } = await import("../lib/integrations/quickbooks/client.ts");
    const result = await ensureFreshTokens({
      accessToken: "old",
      refreshToken: "still_good",
      expiresAt: new Date(Date.now() + 30 * 1000), // 30s — within leeway
      refreshTokenExpiresAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      realmId: "realm_1",
    });
    assert.equal(result.refreshed, true);
    assert.equal(result.tokens.accessToken, "new_access");
    assert.equal(result.tokens.refreshToken, "new_refresh");
    assert.equal(fetchCalls, 1);
  });
  restoreEnv();
});

test("qboFetch retries once with refreshed token on 401", async () => {
  await withQboEnv(async () => {
    const callOrder: string[] = [];
    globalThis.fetch = (async (input: unknown, init?: { headers?: Record<string, string> }) => {
      const url = String(input);
      const auth = init?.headers?.Authorization ?? "";
      if (url.includes("tokens/bearer")) {
        callOrder.push("refresh");
        return new Response(
          JSON.stringify({
            access_token: "refreshed_access",
            refresh_token: "rotated_refresh",
            expires_in: 3600,
            x_refresh_token_expires_in: 8640000,
            token_type: "bearer",
          }),
          { status: 200 },
        );
      }
      if (auth.includes("Bearer stale_access")) {
        callOrder.push("api-stale");
        return new Response("Unauthorized", { status: 401 });
      }
      if (auth.includes("Bearer refreshed_access")) {
        callOrder.push("api-refreshed");
        return new Response(
          JSON.stringify({ QueryResponse: { Customer: [] } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("nope", { status: 500 });
    }) as typeof fetch;

    const { qboGet } = await import("../lib/integrations/quickbooks/client.ts");
    let persisted = 0;
    const result = await qboGet(
      {
        accessToken: "stale_access",
        refreshToken: "still_good_refresh",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
        realmId: "realm_42",
      },
      "query?query=SELECT%20%2A%20FROM%20Customer",
      { onTokenRefresh: async () => { persisted += 1; } },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(callOrder, ["api-stale", "refresh", "api-refreshed"]);
    assert.equal(persisted, 1, "onTokenRefresh should be called once");
    assert.equal(result.tokens.accessToken, "refreshed_access");
  });
  restoreEnv();
});

test("qboFetch surfaces rate_limited on 429", async () => {
  await withQboEnv(async () => {
    globalThis.fetch = (async () => new Response("slow down", { status: 429 })) as typeof fetch;
    const { qboGet } = await import("../lib/integrations/quickbooks/client.ts");
    const result = await qboGet(
      {
        accessToken: "fresh",
        refreshToken: "r",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
        realmId: "realm_1",
      },
      "invoice/123",
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 429);
    assert.equal(result.reason, "rate_limited");
  });
  restoreEnv();
});

test("qboFetch maps network errors to reason=network", async () => {
  await withQboEnv(async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const { qboGet } = await import("../lib/integrations/quickbooks/client.ts");
    const result = await qboGet(
      {
        accessToken: "fresh",
        refreshToken: "r",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
        realmId: "realm_1",
      },
      "customer/1",
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "network");
    assert.match(result.detail, /ECONNREFUSED/);
  });
  restoreEnv();
});

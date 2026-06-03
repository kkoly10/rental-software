/**
 * Tests for the Xero OAuth + API client (Sprint 3.5).
 *
 * Mirrors `quickbooks-client.test.ts` with Xero-specific cases:
 *   - PKCE generation (verifier + SHA-256 challenge)
 *   - Authorize URL includes code_challenge + code_challenge_method
 *   - Token exchange takes the code_verifier
 *   - xero-tenant-id header travels on API calls
 *   - 401 retry-with-refresh
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function withXeroEnv<T>(fn: () => Promise<T> | T): Promise<T> | T {
  Object.assign(process.env, {
    XERO_CLIENT_ID: "test_xero_client",
    XERO_CLIENT_SECRET: "test_xero_secret",
    XERO_REDIRECT_URI: "https://app.example.com/api/integrations/xero/callback",
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

test("generatePkcePair produces a verifier and a SHA-256 challenge derived from it", async () => {
  await withXeroEnv(async () => {
    const { generatePkcePair } = await import("../lib/integrations/xero/client.ts");
    const { verifier, challenge } = generatePkcePair();
    assert.ok(verifier.length >= 43 && verifier.length <= 128, "verifier in spec length range");
    const expected = createHash("sha256").update(verifier).digest("base64url");
    assert.equal(challenge, expected, "challenge is sha256(verifier) base64url");
  });
  restoreEnv();
});

test("buildAuthorizeUrl includes PKCE challenge + S256 method", async () => {
  await withXeroEnv(async () => {
    const { buildAuthorizeUrl } = await import("../lib/integrations/xero/client.ts");
    const url = new URL(buildAuthorizeUrl("opaque-state", "test-challenge"));
    assert.equal(url.origin + url.pathname, "https://login.xero.com/identity/connect/authorize");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("client_id"), "test_xero_client");
    assert.equal(url.searchParams.get("code_challenge"), "test-challenge");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("state"), "opaque-state");
    assert.match(url.searchParams.get("scope") ?? "", /offline_access/);
    assert.match(url.searchParams.get("scope") ?? "", /accounting\.transactions/);
  });
  restoreEnv();
});

test("buildAuthorizeUrl throws when env is missing", async () => {
  delete process.env.XERO_CLIENT_ID;
  const { buildAuthorizeUrl } = await import("../lib/integrations/xero/client.ts");
  assert.throws(() => buildAuthorizeUrl("s", "c"), /not configured/);
  restoreEnv();
});

test("ensureFreshTokens returns current tokens when expiry is far", async () => {
  await withXeroEnv(async () => {
    const { ensureFreshTokens } = await import("../lib/integrations/xero/client.ts");
    const result = await ensureFreshTokens({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      tenantId: "tenant_1",
    });
    assert.equal(result.refreshed, false);
    assert.equal(result.tokens.tenantId, "tenant_1");
  });
  restoreEnv();
});

test("ensureFreshTokens refreshes when access token is within the leeway window — preserves tenantId", async () => {
  await withXeroEnv(async () => {
    globalThis.fetch = (async (input: unknown) => {
      const url = String(input);
      if (url.includes("identity.xero.com/connect/token")) {
        return new Response(
          JSON.stringify({
            access_token: "new_access",
            refresh_token: "new_refresh",
            expires_in: 1800,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("nope", { status: 500 });
    }) as typeof fetch;
    const { ensureFreshTokens } = await import("../lib/integrations/xero/client.ts");
    const result = await ensureFreshTokens({
      accessToken: "old",
      refreshToken: "still_good",
      expiresAt: new Date(Date.now() + 30 * 1000),
      tenantId: "tenant_preserved",
    });
    assert.equal(result.refreshed, true);
    assert.equal(result.tokens.accessToken, "new_access");
    assert.equal(
      result.tokens.tenantId,
      "tenant_preserved",
      "tenantId is not in the token response and must come from the prior tokens",
    );
  });
  restoreEnv();
});

test("xeroGet sends xero-tenant-id + bearer + retries with refresh on 401", async () => {
  await withXeroEnv(async () => {
    const callOrder: string[] = [];
    let lastTenantHeader: string | undefined;
    globalThis.fetch = (async (input: unknown, init?: { headers?: Record<string, string> }) => {
      const url = String(input);
      lastTenantHeader = init?.headers?.["xero-tenant-id"];
      const auth = init?.headers?.Authorization ?? "";
      if (url.includes("identity.xero.com/connect/token")) {
        callOrder.push("refresh");
        return new Response(
          JSON.stringify({
            access_token: "refreshed_access",
            refresh_token: "rotated_refresh",
            expires_in: 1800,
            token_type: "Bearer",
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
          JSON.stringify({ Contacts: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("nope", { status: 500 });
    }) as typeof fetch;

    const { xeroGet } = await import("../lib/integrations/xero/client.ts");
    let persisted = 0;
    const result = await xeroGet(
      {
        accessToken: "stale_access",
        refreshToken: "still_good",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        tenantId: "tenant_42",
      },
      "Contacts",
      { onTokenRefresh: async () => { persisted += 1; } },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(callOrder, ["api-stale", "refresh", "api-refreshed"]);
    assert.equal(lastTenantHeader, "tenant_42", "xero-tenant-id travels on every call");
    assert.equal(persisted, 1);
    assert.equal(result.tokens.accessToken, "refreshed_access");
  });
  restoreEnv();
});

test("xeroGet maps 429 to rate_limited and network errors to network", async () => {
  await withXeroEnv(async () => {
    globalThis.fetch = (async () => new Response("slow down", { status: 429 })) as typeof fetch;
    const { xeroGet } = await import("../lib/integrations/xero/client.ts");
    const rateLimited = await xeroGet(
      {
        accessToken: "fresh",
        refreshToken: "r",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        tenantId: "t",
      },
      "Invoices",
    );
    assert.equal(rateLimited.ok, false);
    if (rateLimited.ok) return;
    assert.equal(rateLimited.reason, "rate_limited");

    globalThis.fetch = (async () => { throw new Error("EAI_AGAIN"); }) as typeof fetch;
    const networkErr = await xeroGet(
      {
        accessToken: "fresh",
        refreshToken: "r",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        tenantId: "t",
      },
      "Invoices",
    );
    assert.equal(networkErr.ok, false);
    if (networkErr.ok) return;
    assert.equal(networkErr.reason, "network");
    assert.match(networkErr.detail, /EAI_AGAIN/);
  });
  restoreEnv();
});

import { createHash, randomBytes } from "node:crypto";
import {
  XERO_API_BASE,
  XERO_AUTHORIZE_URL,
  XERO_CONNECTIONS_URL,
  XERO_REVOKE_URL,
  XERO_SCOPES,
  XERO_TOKEN_REFRESH_LEEWAY_SECONDS,
  XERO_TOKEN_URL,
  getXeroClientId,
  getXeroClientSecret,
  getXeroRedirectUri,
} from "./config.ts";

/**
 * Xero OAuth + API client (Sprint 3.5).
 *
 * Mirrors the QBO client's shape with three Xero-specific differences:
 *
 *   1. PKCE: `buildAuthorizeUrl(state, verifier)` includes the
 *      SHA-256 challenge; `exchangeCodeForTokens(code, verifier)`
 *      sends the verifier in the token request. The verifier is the
 *      caller's responsibility to persist between the connect kickoff
 *      and the callback (we stash it in an HTTP-only cookie alongside
 *      the state).
 *
 *   2. Tenant resolution: the OAuth callback doesn't carry tenant id.
 *      After token exchange, the callback calls `fetchFirstTenant`
 *      against /connections and persists the result alongside the
 *      tokens.
 *
 *   3. Headers: API calls include `xero-tenant-id` alongside the
 *      bearer token.
 */

export type XeroTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tenantId: string;
};

export type XeroTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "Bearer";
  scope?: string;
};

/**
 * PKCE codes — caller generates these once at the start of the OAuth
 * flow. `codeVerifier` is the secret that travels with the auth
 * request via cookie; `codeChallenge` is what we send to Xero.
 */
export function generatePkcePair(): { verifier: string; challenge: string } {
  // 64 bytes of entropy → 86 chars base64url, well above Xero's 43-128
  // char range.
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizeUrl(
  state: string,
  codeChallenge: string,
): string {
  const clientId = getXeroClientId();
  const redirectUri = getXeroRedirectUri();
  if (!clientId || !redirectUri) {
    throw new Error("Xero OAuth not configured");
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: XERO_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${XERO_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<Omit<XeroTokens, "tenantId">> {
  const response = await postToTokenEndpoint({
    grant_type: "authorization_code",
    code,
    redirect_uri: requireEnv(getXeroRedirectUri(), "XERO_REDIRECT_URI"),
    code_verifier: codeVerifier,
  });
  return mapTokenResponse(response);
}

export async function refreshTokens(
  refreshToken: string,
): Promise<Omit<XeroTokens, "tenantId">> {
  const response = await postToTokenEndpoint({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return mapTokenResponse(response);
}

export async function revokeTokens(refreshToken: string): Promise<void> {
  const clientId = requireEnv(getXeroClientId(), "XERO_CLIENT_ID");
  const clientSecret = requireEnv(getXeroClientSecret(), "XERO_CLIENT_SECRET");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  await fetch(XERO_REVOKE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: new URLSearchParams({ token: refreshToken }).toString(),
  });
}

/**
 * After token exchange, fetch the list of tenants the operator just
 * authorized and return the first one's id. Multi-tenant orgs go
 * through Sprint 3.7's chooser UI; for the MVP we take the first
 * connection.
 */
export async function fetchFirstTenant(
  accessToken: string,
): Promise<string | null> {
  const response = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { tenantId?: string }[];
  return body[0]?.tenantId ?? null;
}

export async function ensureFreshTokens(
  current: XeroTokens,
): Promise<{ tokens: XeroTokens; refreshed: boolean }> {
  const expiresInSec = (current.expiresAt.getTime() - Date.now()) / 1000;
  if (expiresInSec > XERO_TOKEN_REFRESH_LEEWAY_SECONDS) {
    return { tokens: current, refreshed: false };
  }
  const refreshed = await refreshTokens(current.refreshToken);
  return {
    tokens: { ...refreshed, tenantId: current.tenantId },
    refreshed: true,
  };
}

export type XeroError = {
  ok: false;
  status: number;
  reason:
    | "unauthorized"
    | "rate_limited"
    | "not_found"
    | "validation"
    | "server"
    | "network";
  detail: string;
};

export async function xeroGet<T = unknown>(
  tokens: XeroTokens,
  path: string,
  options?: { onTokenRefresh?: (next: XeroTokens) => Promise<void> },
): Promise<{ ok: true; data: T; tokens: XeroTokens } | XeroError> {
  return xeroFetch<T>(tokens, "GET", path, undefined, options);
}

export async function xeroPost<T = unknown>(
  tokens: XeroTokens,
  path: string,
  body: unknown,
  options?: { onTokenRefresh?: (next: XeroTokens) => Promise<void> },
): Promise<{ ok: true; data: T; tokens: XeroTokens } | XeroError> {
  return xeroFetch<T>(tokens, "POST", path, body, options);
}

async function xeroFetch<T>(
  tokens: XeroTokens,
  method: "GET" | "POST",
  path: string,
  body: unknown | undefined,
  options?: { onTokenRefresh?: (next: XeroTokens) => Promise<void> },
): Promise<{ ok: true; data: T; tokens: XeroTokens } | XeroError> {
  let currentTokens = tokens;
  let triedRefresh = false;

  while (true) {
    const url = `${XERO_API_BASE}/${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${currentTokens.accessToken}`,
          "xero-tenant-id": currentTokens.tenantId,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return {
        ok: false,
        status: 0,
        reason: "network",
        detail: err instanceof Error ? err.message : String(err),
      };
    }

    if (response.status === 401 && !triedRefresh) {
      triedRefresh = true;
      try {
        const refreshed = await refreshTokens(currentTokens.refreshToken);
        currentTokens = { ...refreshed, tenantId: currentTokens.tenantId };
        if (options?.onTokenRefresh) {
          await options.onTokenRefresh(currentTokens);
        }
        continue;
      } catch (err) {
        return {
          ok: false,
          status: 401,
          reason: "unauthorized",
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    }

    if (response.status === 429) {
      return { ok: false, status: 429, reason: "rate_limited", detail: "Xero rate limit hit" };
    }
    if (response.status === 404) {
      return { ok: false, status: 404, reason: "not_found", detail: await response.text().catch(() => "") };
    }
    if (response.status >= 500) {
      return { ok: false, status: response.status, reason: "server", detail: await response.text().catch(() => "") };
    }
    if (response.status >= 400) {
      return { ok: false, status: response.status, reason: "validation", detail: await response.text().catch(() => "") };
    }

    const data = (await response.json()) as T;
    return { ok: true, data, tokens: currentTokens };
  }
}

async function postToTokenEndpoint(
  params: Record<string, string>,
): Promise<XeroTokenResponse> {
  const clientId = requireEnv(getXeroClientId(), "XERO_CLIENT_ID");
  const clientSecret = requireEnv(getXeroClientSecret(), "XERO_CLIENT_SECRET");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const form = new URLSearchParams(params);
  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: form.toString(),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Xero token endpoint ${response.status}: ${body}`);
  }
  return (await response.json()) as XeroTokenResponse;
}

function mapTokenResponse(
  response: XeroTokenResponse,
): Omit<XeroTokens, "tenantId"> {
  const now = Date.now();
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: new Date(now + response.expires_in * 1000),
  };
}

function requireEnv<T>(value: T | undefined, name: string): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Xero ${name} not configured`);
  }
  return value;
}

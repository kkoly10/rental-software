import {
  QBO_AUTHORIZE_URL,
  QBO_REVOKE_URL,
  QBO_SCOPES,
  QBO_TOKEN_REFRESH_LEEWAY_SECONDS,
  QBO_TOKEN_URL,
  getQboApiBase,
  getQboClientId,
  getQboClientSecret,
  getQboRedirectUri,
} from "./config.ts";

/**
 * Minimal Intuit QuickBooks Online OAuth + API client (Sprint 2).
 *
 * Scope:
 *   - Build the authorize URL the operator gets redirected to
 *   - Exchange the auth code for tokens at the OAuth callback
 *   - Refresh the access token when it's near expiry
 *   - Revoke the refresh token on disconnect
 *   - Make authenticated GET / POST calls against the Accounting API,
 *     with auto-refresh on 401
 *
 * Deliberately not yet implemented (deferred to Sprint 2.5):
 *   - Batched POSTs (the QBO BatchOperation endpoint)
 *   - Webhook signature verification
 *   - PDF retrieval
 *
 * The whole module is environment-aware: `hasQuickBooksEnv()` must
 * return true before any call here will succeed. Other modules should
 * gate on it explicitly so demo / preview environments stay quiet.
 */

export type QboTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshTokenExpiresAt: Date;
  realmId: string;
};

export type QboTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: "bearer";
};

/**
 * Build the Intuit authorize URL. Operator gets redirected here from
 * the Connect QuickBooks button. State is a random/opaque value the
 * caller persists and verifies in the callback.
 */
export function buildAuthorizeUrl(state: string): string {
  const clientId = getQboClientId();
  const redirectUri = getQboRedirectUri();
  if (!clientId || !redirectUri) {
    throw new Error("QuickBooks OAuth not configured");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: QBO_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `${QBO_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange the one-time `code` from Intuit's callback for access +
 * refresh tokens. Called by the OAuth callback route. `realmId` comes
 * from a separate query parameter that Intuit attaches alongside `code`.
 */
export async function exchangeCodeForTokens(
  code: string,
  realmId: string,
): Promise<QboTokens> {
  const response = await postToTokenEndpoint({
    grant_type: "authorization_code",
    code,
    redirect_uri: requireEnv(getQboRedirectUri(), "QBO_REDIRECT_URI"),
  });
  return mapTokenResponse(response, realmId);
}

/**
 * Refresh the access token using the long-lived refresh token. Called
 * lazily from `ensureFreshTokens` when the access token is near expiry.
 * Intuit may rotate the refresh token too — we store whatever it sends
 * back rather than assuming the old one stays valid.
 */
export async function refreshTokens(
  refreshToken: string,
  realmId: string,
): Promise<QboTokens> {
  const response = await postToTokenEndpoint({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return mapTokenResponse(response, realmId);
}

/**
 * Revoke the refresh token at Intuit. Called on disconnect so the
 * operator's QBO account is no longer linked to Korent. Failures are
 * logged but not surfaced — local DB cleanup proceeds regardless.
 */
export async function revokeTokens(refreshToken: string): Promise<void> {
  const clientId = requireEnv(getQboClientId(), "QBO_CLIENT_ID");
  const clientSecret = requireEnv(getQboClientSecret(), "QBO_CLIENT_SECRET");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  await fetch(QBO_REVOKE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ token: refreshToken }),
  });
}

/**
 * Given the currently stored tokens, return tokens fresh enough to use
 * for an API call. If the access token is within the leeway window of
 * expiring, refresh and return the new tokens (caller is responsible
 * for persisting them).
 */
export async function ensureFreshTokens(
  current: QboTokens,
): Promise<{ tokens: QboTokens; refreshed: boolean }> {
  const now = Date.now();
  const expiresInSec = (current.expiresAt.getTime() - now) / 1000;
  if (expiresInSec > QBO_TOKEN_REFRESH_LEEWAY_SECONDS) {
    return { tokens: current, refreshed: false };
  }
  const refreshed = await refreshTokens(current.refreshToken, current.realmId);
  return { tokens: refreshed, refreshed: true };
}

/**
 * Authenticated GET against the QBO Accounting API. `path` is the
 * suffix after `/v3/company/{realmId}/`, e.g. `query?query=SELECT...`
 *
 * Auto-refreshes the access token on 401 once (lets the caller persist
 * the new tokens via the `onTokenRefresh` callback). Anything else is
 * returned as a typed error so callers can route around it.
 */
export async function qboGet<T = unknown>(
  tokens: QboTokens,
  path: string,
  options?: { onTokenRefresh?: (next: QboTokens) => Promise<void> },
): Promise<{ ok: true; data: T; tokens: QboTokens } | QboError> {
  return qboFetch<T>(tokens, "GET", path, undefined, options);
}

/**
 * Authenticated POST. Body is JSON-serialized. Used for Customer /
 * Invoice / Item creates.
 */
export async function qboPost<T = unknown>(
  tokens: QboTokens,
  path: string,
  body: unknown,
  options?: { onTokenRefresh?: (next: QboTokens) => Promise<void> },
): Promise<{ ok: true; data: T; tokens: QboTokens } | QboError> {
  return qboFetch<T>(tokens, "POST", path, body, options);
}

export type QboError = {
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

async function qboFetch<T>(
  tokens: QboTokens,
  method: "GET" | "POST",
  path: string,
  body: unknown | undefined,
  options?: { onTokenRefresh?: (next: QboTokens) => Promise<void> },
): Promise<{ ok: true; data: T; tokens: QboTokens } | QboError> {
  let currentTokens = tokens;
  let triedRefresh = false;

  while (true) {
    const url = `${getQboApiBase()}/${currentTokens.realmId}/${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${currentTokens.accessToken}`,
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
      // Stored token was rejected. Refresh once and retry. The
      // `onTokenRefresh` callback lets the caller persist the new
      // tokens so future calls don't redo the refresh dance.
      triedRefresh = true;
      try {
        const refreshed = await refreshTokens(
          currentTokens.refreshToken,
          currentTokens.realmId,
        );
        currentTokens = refreshed;
        if (options?.onTokenRefresh) {
          await options.onTokenRefresh(refreshed);
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
      return { ok: false, status: 429, reason: "rate_limited", detail: "Intuit rate limit hit" };
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
): Promise<QboTokenResponse> {
  const clientId = requireEnv(getQboClientId(), "QBO_CLIENT_ID");
  const clientSecret = requireEnv(getQboClientSecret(), "QBO_CLIENT_SECRET");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const form = new URLSearchParams(params);

  const response = await fetch(QBO_TOKEN_URL, {
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
    throw new Error(`QBO token endpoint ${response.status}: ${body}`);
  }
  return (await response.json()) as QboTokenResponse;
}

function mapTokenResponse(
  response: QboTokenResponse,
  realmId: string,
): QboTokens {
  const now = Date.now();
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: new Date(now + response.expires_in * 1000),
    refreshTokenExpiresAt: new Date(
      now + response.x_refresh_token_expires_in * 1000,
    ),
    realmId,
  };
}

function requireEnv<T>(value: T | undefined, name: string): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(`QuickBooks ${name} not configured`);
  }
  return value;
}

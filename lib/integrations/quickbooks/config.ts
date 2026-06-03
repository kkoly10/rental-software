import { getOptionalEnv } from "../../env.ts";

/**
 * QuickBooks Online integration config (Sprint 2).
 *
 * Environment variables expected (set in Vercel → Settings → Env vars):
 *
 *   QBO_CLIENT_ID         — OAuth client id from the Intuit developer
 *                           portal app
 *   QBO_CLIENT_SECRET     — OAuth client secret (treat as a Stripe-grade
 *                           secret; never log)
 *   QBO_ENVIRONMENT       — "sandbox" (default) or "production". Drives
 *                           the API and OAuth endpoint hosts. Once we're
 *                           Intuit-certified we flip this to "production"
 *                           and re-issue tokens.
 *   QBO_REDIRECT_URI      — Full URL of the OAuth callback, e.g.
 *                           https://app.korent.com/api/integrations/quickbooks/callback
 *                           Must match the registered redirect URI in the
 *                           Intuit app config exactly.
 *
 * All four are optional at module-load time so the rest of the app
 * keeps booting in environments where QBO isn't configured (demo mode,
 * preview deploys). Callers must check `hasQuickBooksEnv()` before
 * trying to exercise the OAuth/API surface.
 */
export type QboEnvironment = "sandbox" | "production";

export function getQboEnvironment(): QboEnvironment {
  const raw = (getOptionalEnv("QBO_ENVIRONMENT") ?? "sandbox").toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

export function getQboClientId(): string | undefined {
  return getOptionalEnv("QBO_CLIENT_ID");
}

export function getQboClientSecret(): string | undefined {
  return getOptionalEnv("QBO_CLIENT_SECRET");
}

export function getQboRedirectUri(): string | undefined {
  return getOptionalEnv("QBO_REDIRECT_URI");
}

export function hasQuickBooksEnv(): boolean {
  return (
    Boolean(getQboClientId()) &&
    Boolean(getQboClientSecret()) &&
    Boolean(getQboRedirectUri())
  );
}

/**
 * Intuit OAuth and API endpoints. The OAuth host is constant; only
 * the API host changes between sandbox and production.
 */
export const QBO_AUTHORIZE_URL =
  "https://appcenter.intuit.com/connect/oauth2";
export const QBO_TOKEN_URL =
  "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export const QBO_REVOKE_URL =
  "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

export function getQboApiBase(): string {
  return getQboEnvironment() === "production"
    ? "https://quickbooks.api.intuit.com/v3/company"
    : "https://sandbox-quickbooks.api.intuit.com/v3/company";
}

/**
 * Intuit's OAuth scope strings. We always request both `accounting`
 * (Invoice / Customer / Item access) and `openid` so the callback
 * carries the realmId. `payment` is not needed — we just record paid
 * status, we don't push receipts.
 */
export const QBO_SCOPES = "com.intuit.quickbooks.accounting openid";

/**
 * Token refresh safety window. We treat the access token as expired
 * if it will expire in the next 60 seconds, so an in-flight API call
 * doesn't get caught by an expiry mid-request.
 */
export const QBO_TOKEN_REFRESH_LEEWAY_SECONDS = 60;

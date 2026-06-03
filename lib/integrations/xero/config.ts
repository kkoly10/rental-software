import { getOptionalEnv } from "../../env.ts";

/**
 * Xero integration config (Sprint 3.5).
 *
 * Sibling of the QuickBooks config — same env-var lookup shape, same
 * has-env gate. Two Xero-specific things to know:
 *
 *   1. **PKCE is required.** Xero's OAuth flow uses Proof Key for
 *      Code Exchange even though we have a confidential client. The
 *      client module generates the code_verifier per request and
 *      sends the SHA-256 code_challenge in the authorize URL.
 *
 *   2. **Tenant resolution is a separate step.** The OAuth callback
 *      doesn't carry the tenant id (Xero's word for "company"). We
 *      call /connections immediately after the code exchange and
 *      stash the first tenant_id. Multi-tenant orgs need a chooser
 *      UI (Sprint 3.7 follow-up); the MVP uses the first connection.
 *
 * Environment variables (set in Vercel → Settings → Env vars):
 *
 *   XERO_CLIENT_ID          OAuth client id from the Xero developer
 *                           portal app
 *   XERO_CLIENT_SECRET      OAuth client secret
 *   XERO_REDIRECT_URI       Full URL of the OAuth callback (must
 *                           match registered URI exactly)
 *   XERO_ENVIRONMENT        Sandbox vs production is not a deploy-
 *                           time choice for Xero — the same auth +
 *                           api URLs serve both, and the app's
 *                           certification state is held in the Xero
 *                           dev portal. Reserved for future use.
 */
export function getXeroClientId(): string | undefined {
  return getOptionalEnv("XERO_CLIENT_ID");
}

export function getXeroClientSecret(): string | undefined {
  return getOptionalEnv("XERO_CLIENT_SECRET");
}

export function getXeroRedirectUri(): string | undefined {
  return getOptionalEnv("XERO_REDIRECT_URI");
}

export function hasXeroEnv(): boolean {
  return (
    Boolean(getXeroClientId()) &&
    Boolean(getXeroClientSecret()) &&
    Boolean(getXeroRedirectUri())
  );
}

export const XERO_AUTHORIZE_URL =
  "https://login.xero.com/identity/connect/authorize";
export const XERO_TOKEN_URL =
  "https://identity.xero.com/connect/token";
export const XERO_REVOKE_URL =
  "https://identity.xero.com/connect/revocation";
export const XERO_CONNECTIONS_URL =
  "https://api.xero.com/connections";
export const XERO_API_BASE =
  "https://api.xero.com/api.xro/2.0";

/**
 * Scopes: `offline_access` is required to receive a refresh token.
 * `accounting.transactions` + `accounting.contacts` cover Invoice
 * creation and Contact (Customer) upsert. `openid` lets us verify
 * the user identity if we ever need it. `accounting.settings.read`
 * gives access to account codes (chart of accounts) so future
 * versions can let operators pick which account invoices land in.
 */
export const XERO_SCOPES =
  "openid profile email offline_access accounting.transactions accounting.contacts accounting.settings.read";

export const XERO_TOKEN_REFRESH_LEEWAY_SECONDS = 60;

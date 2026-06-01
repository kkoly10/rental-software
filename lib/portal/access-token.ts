import crypto from "node:crypto";

const TOKEN_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

export function isPortalTokenExpired(createdAt: string | null | undefined): boolean {
  if (!createdAt) return true; // missing timestamp = treat as expired; all new tokens record created_at
  return Date.now() - new Date(createdAt).getTime() > TOKEN_MAX_AGE_MS;
}

export function createPortalAccessToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function hashPortalAccessToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issuePortalAccessToken(options: {
  supabase: any;
  orderId: string;
}): Promise<string> {
  const token = createPortalAccessToken();
  const tokenHash = hashPortalAccessToken(token);

  const { error } = await options.supabase
    .from("orders")
    .update({
      portal_access_token_hash: tokenHash,
      portal_access_token_created_at: new Date().toISOString(),
    })
    .eq("id", options.orderId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to issue portal access token: ${error.message}`);
  }

  return token;
}

/**
 * Invalidate the portal token currently on an order so any outstanding links
 * (in customer email archives, leaked screenshots, breached inboxes) stop
 * working immediately. The customer can re-acquire access at /order-status
 * via the order-number + email lookup form, which will issue a fresh token.
 *
 * Idempotent — calling it on an order without a token is a no-op.
 */
export async function revokePortalAccessTokenRow(options: {
  supabase: any;
  orderId: string;
  organizationId: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { error } = await options.supabase
    .from("orders")
    .update({
      portal_access_token_hash: null,
      portal_access_token_created_at: null,
    })
    .eq("id", options.orderId)
    .eq("organization_id", options.organizationId)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

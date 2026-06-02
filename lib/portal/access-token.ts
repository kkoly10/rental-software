import crypto from "node:crypto";

// 90 days. A leaked portal token grants read+write access to the order
// (sign documents, cancel booking, pay balance), so the previous 365-day
// window was an unbounded liability for any token included in an email
// that later sat in an inbox archive or breach dump. 90 days covers the
// realistic span between booking, event, balance settlement, and
// post-event review while keeping a leak short-lived.
//
// Customers whose token expires can still recover access via the
// order-number + email lookup at /order-status, so this isn't a
// dead-end UX — just a re-auth step.
//
// Configurable per-deploy via PORTAL_TOKEN_MAX_AGE_DAYS in case an
// operator has long quote cycles or wants to extend during migration.
const DEFAULT_MAX_AGE_DAYS = 90;

function getMaxAgeMs(): number {
  const raw = process.env.PORTAL_TOKEN_MAX_AGE_DAYS;
  const parsed = raw ? Number(raw) : NaN;
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_AGE_DAYS;
  return days * 24 * 60 * 60 * 1000;
}

export function isPortalTokenExpired(createdAt: string | null | undefined): boolean {
  if (!createdAt) return true; // missing timestamp = treat as expired; all new tokens record created_at
  return Date.now() - new Date(createdAt).getTime() > getMaxAgeMs();
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

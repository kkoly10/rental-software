import crypto from "node:crypto";

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
    .eq("id", options.orderId);

  if (error) {
    throw new Error(`Failed to issue portal access token: ${error.message}`);
  }

  return token;
}

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getOptionalEnv } from "@/lib/env";

/**
 * View-in-browser token. Format: `<communicationLogId>.<hmac>` where the
 * HMAC is `sha256(communicationLogId)` keyed by `EMAIL_VIEW_SECRET`.
 * No expiry — the operator's portal token revocation flow doesn't apply
 * here because these views render archival sent-email HTML, not give
 * portal write access.
 */
function getSecret(): string | null {
  const raw = getOptionalEnv("EMAIL_VIEW_SECRET");
  if (!raw) return null;
  return raw;
}

export function signEmailViewToken(communicationLogId: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const mac = createHmac("sha256", secret).update(communicationLogId).digest("hex");
  return `${communicationLogId}.${mac}`;
}

export function verifyEmailViewToken(token: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const claimed = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(id).digest("hex");
  if (claimed.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(claimed, "hex"), Buffer.from(expected, "hex"))) {
      return null;
    }
  } catch {
    return null;
  }
  return id;
}

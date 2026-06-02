import type { NextRequest } from "next/server";

/**
 * Resolve the client IP from a set of request headers, choosing only
 * values our edge (Vercel / a configured trusted proxy) actually
 * controls.
 *
 * Why not just `x-forwarded-for[0]` or `x-real-ip`?
 *  - `x-real-ip` is supplied by the CLIENT verbatim on Vercel. A
 *    request can set `X-Real-IP: 1.2.3.4` and our rate limiter would
 *    bucket them against 1.2.3.4 (someone else's slot). Removed.
 *  - `x-forwarded-for[0]` is also client-supplied. Anyone can prepend
 *    arbitrary entries before the platform-added value.
 *  - Vercel appends the real client to the end of `x-forwarded-for`
 *    so `.at(-1)` is safe, BUT only when the immediate caller IS
 *    Vercel. Self-hosted deployments behind a different proxy need
 *    a different mechanism.
 *
 * Preference order:
 *  1. `x-vercel-forwarded-for` — platform-trusted single IP, only set
 *     by Vercel itself, never propagated from inbound headers.
 *  2. `x-forwarded-for` LAST entry — Vercel appends, so last-entry is
 *     the value the platform observed regardless of client tampering.
 *  3. fallback "unknown" — better an inert bucket than a spoofable one.
 */
export function getTrustedClientIp(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) return vercel;

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const last = xff.split(",").at(-1)?.trim();
    if (last) return last;
  }

  return "unknown";
}

export function getRequestClientKey(request: NextRequest) {
  return getTrustedClientIp(request.headers);
}

import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getOptionalEnv } from "@/lib/env";

/**
 * Validates the `Authorization: Bearer <secret>` header on a cron route
 * using a constant-time comparison so an attacker can't brute-force
 * `CRON_SECRET` one byte at a time via response-timing side channels.
 *
 * Fails closed: returns false when `CRON_SECRET` is not configured so
 * the route cannot be publicly hit on a misconfigured deployment.
 */
export function verifyCronSecret(request: NextRequest | Request): boolean {
  const expected = getOptionalEnv("CRON_SECRET");
  if (!expected) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const expectedHeader = `Bearer ${expected}`;
  // Buffer.byteLength differing short-circuits timingSafeEqual with throw,
  // so guard explicitly and fall through to a same-length dummy compare to
  // keep the rejection time independent of the supplied secret length.
  const expectedBuf = Buffer.from(expectedHeader, "utf8");
  const actualBuf = Buffer.from(authHeader, "utf8");

  if (actualBuf.length !== expectedBuf.length) {
    // Run a dummy compare against itself so the elapsed time is similar
    // whether the lengths match or not.
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return timingSafeEqual(actualBuf, expectedBuf);
}

import test from "node:test";
import assert from "node:assert/strict";
import { resolveRateLimitFallback } from "../lib/security/rate-limit-policy.ts";

test("strict fallback fails closed", () => {
  const result = resolveRateLimitFallback({
    scope: "checkout:client",
    limit: 8,
    windowSeconds: 3600,
    strict: true,
  });

  assert.deepEqual(result, {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 300,
    logLevel: "error",
  });
});

test("non-strict fallback degrades open", () => {
  const result = resolveRateLimitFallback({
    scope: "portal:lookup:client",
    limit: 10,
    windowSeconds: 900,
    strict: false,
  });

  assert.deepEqual(result, {
    allowed: true,
    remaining: 10,
    retryAfterSeconds: 0,
    logLevel: "warn",
  });
});

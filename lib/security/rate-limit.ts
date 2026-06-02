import crypto from "node:crypto";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import {
  type RateLimitFallbackReason,
  resolveRateLimitFallback,
} from "@/lib/security/rate-limit-policy";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitOptions = {
  scope: string;
  actor: string;
  limit: number;
  windowSeconds: number;
  strict?: boolean;
};

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const strict = options.strict ?? false;

  // No Supabase service-role env at all → demo/dev mode. Fail-open is
  // intentional here (the limiter can't function), separate from
  // production infra errors below.
  if (!hasSupabaseServiceRoleEnv()) {
    return fallbackResult(options, strict, "missing_service_role_env");
  }

  // One retry on infra error before falling back. Production hiccups are
  // common enough that a 100ms retry catches a meaningful share of them.
  let lastError: { reason: "rpc_error" | "invalid_rpc_payload" | "exception"; detail?: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const admin = createSupabaseAdminClient();
      const actorKey = hashActorKey(options.actor);

      const { data, error } = await admin.rpc("apply_rate_limit", {
        p_scope: options.scope,
        p_actor_key: actorKey,
        p_limit: options.limit,
        p_window_seconds: options.windowSeconds,
      });

      if (error) {
        lastError = { reason: "rpc_error", detail: error.message };
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        if (!row || typeof row.allowed !== "boolean") {
          lastError = { reason: "invalid_rpc_payload" };
        } else {
          return {
            allowed: row.allowed,
            remaining: Number(row.remaining ?? options.limit),
            retryAfterSeconds: Number(row.retry_after_seconds ?? 0),
          };
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      lastError = { reason: "exception", detail };
    }

    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return fallbackResult(options, strict, lastError!.reason, lastError!.detail);
}

function hashActorKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fallbackResult(
  options: RateLimitOptions,
  strict: boolean,
  reason: "missing_service_role_env" | "rpc_error" | "invalid_rpc_payload" | "exception",
  detail?: string
): RateLimitResult {
  const context = {
    scope: options.scope,
    strict,
    reason,
  };

  // Demo/dev mode without the service-role env: the limiter physically
  // cannot run, so fail-open. This is the only fail-open path.
  if (reason === "missing_service_role_env" && !strict) {
    console.warn("[rate-limit] fallback allow (no service-role env)", context);
    return {
      allowed: true,
      remaining: options.limit,
      retryAfterSeconds: 0,
    };
  }

  // Production infra error: fail-closed regardless of `strict`. Leaving
  // the rate-limit broken open during a DB outage means an attacker can
  // hammer the API with no throttle — exactly the wrong response.
  console.error("[rate-limit] fallback deny", detail ? { ...context, detail } : context);
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.min(Math.max(options.windowSeconds, 30), 300),
  };
}

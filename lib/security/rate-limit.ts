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

  if (!hasSupabaseServiceRoleEnv()) {
    return fallbackResult(options, strict, "missing_service_role_env");
  }

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
      return fallbackResult(options, strict, "rpc_error", error.message);
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row || typeof row.allowed !== "boolean") {
      return fallbackResult(options, strict, "invalid_rpc_payload");
    }

    return {
      allowed: row.allowed,
      remaining: Number(row.remaining ?? options.limit),
      retryAfterSeconds: Number(row.retry_after_seconds ?? 0),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return fallbackResult(options, strict, "exception", detail);
  }
}

function hashActorKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fallbackResult(
  options: RateLimitOptions,
  strict: boolean,
  reason: RateLimitFallbackReason,
  detail?: string
): RateLimitResult {
  const context = {
    scope: options.scope,
    strict,
    reason,
  };

  const policy = resolveRateLimitFallback({
    scope: options.scope,
    strict,
    limit: options.limit,
    windowSeconds: options.windowSeconds,
  });

  const payload = detail ? { ...context, detail } : context;
  if (policy.logLevel === "error") {
    console.error("[rate-limit] strict fallback deny", payload);
  } else {
    console.warn("[rate-limit] fallback allow", payload);
  }

  return {
    allowed: policy.allowed,
    remaining: policy.remaining,
    retryAfterSeconds: policy.retryAfterSeconds,
  };
}

import crypto from "node:crypto";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";

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
  reason: "missing_service_role_env" | "rpc_error" | "invalid_rpc_payload" | "exception",
  detail?: string
): RateLimitResult {
  const context = {
    scope: options.scope,
    strict,
    reason,
  };

  if (strict) {
    console.error("[rate-limit] strict fallback deny", detail ? { ...context, detail } : context);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.min(Math.max(options.windowSeconds, 30), 300),
    };
  }

  console.warn("[rate-limit] fallback allow", detail ? { ...context, detail } : context);
  return {
    allowed: true,
    remaining: options.limit,
    retryAfterSeconds: 0,
  };
}

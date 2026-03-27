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

export async function enforceRateLimit(options: {
  scope: string;
  actor: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  if (!hasSupabaseServiceRoleEnv()) {
    return {
      allowed: true,
      remaining: options.limit,
      retryAfterSeconds: 0,
    };
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
      console.error("Rate limit check failed:", error.message);
      return {
        allowed: true,
        remaining: options.limit,
        retryAfterSeconds: 0,
      };
    }

    const row = Array.isArray(data) ? data[0] : data;

    return {
      allowed: Boolean(row?.allowed ?? true),
      remaining: Number(row?.remaining ?? options.limit),
      retryAfterSeconds: Number(row?.retry_after_seconds ?? 0),
    };
  } catch (error) {
    console.error("Rate limit check threw:", error);
    return {
      allowed: true,
      remaining: options.limit,
      retryAfterSeconds: 0,
    };
  }
}

function hashActorKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
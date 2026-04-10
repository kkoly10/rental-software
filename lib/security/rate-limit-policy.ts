export type RateLimitFallbackReason =
  | "missing_service_role_env"
  | "rpc_error"
  | "invalid_rpc_payload"
  | "exception";

export type RateLimitFallbackOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
  strict: boolean;
};

export type RateLimitPolicyResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  logLevel: "warn" | "error";
};

export function resolveRateLimitFallback(options: RateLimitFallbackOptions): RateLimitPolicyResult {
  if (options.strict) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.min(Math.max(options.windowSeconds, 30), 300),
      logLevel: "error",
    };
  }

  return {
    allowed: true,
    remaining: options.limit,
    retryAfterSeconds: 0,
    logLevel: "warn",
  };
}

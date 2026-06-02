import { createSupabaseAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";

function sanitizePayload(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value ?? {}));
  } catch {
    return {};
  }
}

export async function logAppEvent(input: {
  organizationId?: string | null;
  userId?: string | null;
  source: string;
  action: string;
  status?: string;
  route?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!hasSupabaseServiceRoleEnv()) {
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    await admin.from("app_event_logs").insert({
      organization_id: input.organizationId ?? null,
      user_id: input.userId ?? null,
      source: input.source,
      action: input.action,
      status: input.status ?? "info",
      route: input.route ?? null,
      metadata: sanitizePayload(input.metadata),
    });
  } catch (error) {
    console.error("Failed to log app event", error);
  }
}

/**
 * Surface when a list query returned exactly its configured `.limit(n)`.
 * That is the operator's signal that more rows exist but were silently
 * truncated — important for analytics totals and search results, where
 * a missing tail of orders/customers/payments produces wrong numbers
 * without any error to investigate.
 *
 * No-op when the row count is below the limit so we don't spam logs for
 * healthy queries.
 */
export async function logTruncation(input: {
  organizationId?: string | null;
  source: string;
  rowCount: number;
  limit: number;
  metadata?: Record<string, unknown>;
}) {
  if (input.rowCount < input.limit) return;
  await logAppEvent({
    organizationId: input.organizationId ?? null,
    source: input.source,
    action: "truncation_warning",
    status: "warning",
    metadata: {
      rowCount: input.rowCount,
      limit: input.limit,
      ...(input.metadata ?? {}),
    },
  });
}

export async function logAppError(input: {
  organizationId?: string | null;
  userId?: string | null;
  source: string;
  message: string;
  route?: string | null;
  stack?: string | null;
  context?: Record<string, unknown>;
  error?: unknown;
}) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (input.organizationId) scope.setTag("organization_id", input.organizationId);
      if (input.userId) scope.setUser({ id: input.userId });
      if (input.route) scope.setTag("route", input.route);
      scope.setTag("source", input.source);
      if (input.context) scope.setExtras(input.context);

      let err: Error;
      if (input.error instanceof Error) {
        err = input.error;
      } else {
        // Reconstruct a real Error so Sentry shows a stack trace rather
        // than a plain message — callers pass stack as a string field.
        err = new Error(input.message);
        if (input.stack) err.stack = input.stack;
      }
      Sentry.captureException(err);
    });
  }

  if (!hasSupabaseServiceRoleEnv()) {
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    await admin.from("app_error_logs").insert({
      organization_id: input.organizationId ?? null,
      user_id: input.userId ?? null,
      source: input.source,
      message: input.message,
      route: input.route ?? null,
      stack: input.stack ?? null,
      context: sanitizePayload(input.context),
    });
  } catch (error) {
    console.error("Failed to log app error", error);
  }
}

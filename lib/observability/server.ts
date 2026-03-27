import { createSupabaseAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";

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

export async function logAppError(input: {
  organizationId?: string | null;
  userId?: string | null;
  source: string;
  message: string;
  route?: string | null;
  stack?: string | null;
  context?: Record<string, unknown>;
}) {
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

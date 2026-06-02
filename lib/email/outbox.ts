import "server-only";
import { createSupabaseAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
import { logAppError } from "@/lib/observability/server";

const MAX_ATTEMPTS = 6; // ~ 31s + 1m + 2m + 4m + 8m of backoff before failing.

export type OutboxRow = {
  organization_id: string | null;
  order_id?: string | null;
  customer_id?: string | null;
  to_email: string;
  subject: string;
  html: string;
  text_body?: string | null;
  reply_to?: string | null;
  from_address?: string | null;
  headers?: Record<string, string> | null;
  idempotency_key?: string | null;
  last_error?: string | null;
};

/**
 * Enqueue an email for the retry cron to pick up. Called by `sendEmail`
 * when the synchronous Resend attempt errors with a 5xx (or throws).
 *
 * No-op when the service-role admin client isn't configured; in that
 * dev scenario the send error has already been logged.
 */
export async function enqueueEmailForRetry(row: OutboxRow): Promise<void> {
  if (!hasSupabaseServiceRoleEnv()) return;
  try {
    const admin = createSupabaseAdminClient();
    // Initial retry after ~31 seconds gives Resend room for transient
    // recovery. Backoff doubles from there.
    const nextRetryAt = new Date(Date.now() + 31_000).toISOString();
    await admin.from("email_outbox").insert({
      organization_id: row.organization_id,
      order_id: row.order_id ?? null,
      customer_id: row.customer_id ?? null,
      to_email: row.to_email,
      subject: row.subject,
      html: row.html,
      text_body: row.text_body ?? null,
      reply_to: row.reply_to ?? null,
      from_address: row.from_address ?? null,
      headers: row.headers ?? {},
      idempotency_key: row.idempotency_key ?? null,
      status: "pending",
      attempts: 1,
      last_error: row.last_error ?? null,
      next_retry_at: nextRetryAt,
    });
  } catch (err) {
    await logAppError({
      organizationId: row.organization_id ?? undefined,
      source: "email.outbox.enqueue",
      message: err instanceof Error ? err.message : "outbox insert failed",
      error: err,
    });
  }
}

/** Doubling backoff in seconds: 31, 62, 124, 248, 496, 992 */
export function nextBackoffSeconds(attemptsAfterIncrement: number): number {
  return 31 * 2 ** Math.max(0, attemptsAfterIncrement - 1);
}

export const OUTBOX_MAX_ATTEMPTS = MAX_ATTEMPTS;

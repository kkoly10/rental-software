import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getOptionalEnv } from "@/lib/env";
import { getResend, hasResendEnv } from "@/lib/email/client";
import { verifyCronSecret } from "@/lib/security/cron-auth";
import { logAppError, logAppEvent } from "@/lib/observability/server";
import { OUTBOX_MAX_ATTEMPTS, nextBackoffSeconds } from "@/lib/email/outbox";

export const maxDuration = 60;

const BATCH = 25;

/**
 * Retry the email outbox. Runs every 5 minutes via vercel.json. Picks up
 * pending rows whose `next_retry_at` has elapsed, retries with Resend,
 * and either:
 *   - marks `sent` on success,
 *   - bumps `attempts` + reschedules `next_retry_at` on failure (doubling
 *     backoff), or
 *   - marks `failed` once `attempts >= OUTBOX_MAX_ATTEMPTS`.
 *
 * Concurrency-safe via an atomic `status = "sending"` claim per row —
 * two cron instances run side-by-side without double-sending.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (!hasResendEnv()) {
    return NextResponse.json({ ok: true, message: "No Resend env — skipping." });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: due, error: dueErr } = await admin
    .from("email_outbox")
    .select("id")
    .eq("status", "pending")
    .lte("next_retry_at", now)
    .order("next_retry_at", { ascending: true })
    .limit(BATCH);
  if (dueErr) {
    await logAppError({
      source: "cron.email_retry",
      message: `Outbox lookup failed: ${dueErr.message}`,
    });
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0, failed: 0 });
  }

  let sent = 0;
  let failed = 0;
  const resend = getResend();

  for (const row of due) {
    // Atomic claim — only one cron instance flips the row to "sending".
    const { data: claimed } = await admin
      .from("email_outbox")
      .update({ status: "sending" })
      .eq("id", row.id)
      .eq("status", "pending")
      .select(
        "id, organization_id, to_email, subject, html, text_body, reply_to, from_address, headers, idempotency_key, attempts"
      )
      .maybeSingle();
    if (!claimed) continue;

    const headersInput = (claimed.headers ?? {}) as Record<string, string>;

    try {
      const { error } = await resend.emails.send({
        from: claimed.from_address ?? getOptionalEnv("EMAIL_FROM_ADDRESS") ?? "noreply@korent.app",
        to: claimed.to_email,
        subject: claimed.subject,
        html: claimed.html,
        text: claimed.text_body ?? undefined,
        replyTo: claimed.reply_to ?? undefined,
        headers: headersInput,
      });

      if (error) {
        await handleFailure(admin, claimed.id, claimed.attempts, error.message);
        failed++;
        continue;
      }

      await admin
        .from("email_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", claimed.id);
      sent++;
    } catch (err) {
      await handleFailure(
        admin,
        claimed.id,
        claimed.attempts,
        err instanceof Error ? err.message : "Unknown SDK error"
      );
      failed++;
    }
  }

  await logAppEvent({
    source: "cron.email_retry",
    action: "batch",
    status: "info",
    metadata: { processed: due.length, sent, failed },
  });

  return NextResponse.json({ ok: true, processed: due.length, sent, failed });
}

async function handleFailure(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  id: string,
  previousAttempts: number,
  message: string
) {
  const attempts = previousAttempts + 1;
  if (attempts >= OUTBOX_MAX_ATTEMPTS) {
    await admin
      .from("email_outbox")
      .update({
        status: "failed",
        attempts,
        last_error: message,
        failed_at: new Date().toISOString(),
      })
      .eq("id", id);
    return;
  }
  const delaySec = nextBackoffSeconds(attempts);
  const nextRetryAt = new Date(Date.now() + delaySec * 1000).toISOString();
  await admin
    .from("email_outbox")
    .update({
      status: "pending",
      attempts,
      last_error: message,
      next_retry_at: nextRetryAt,
    })
    .eq("id", id);
}

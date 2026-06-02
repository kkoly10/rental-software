import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/security/cron-auth";
import { logAppEvent, logAppError } from "@/lib/observability/server";

export const maxDuration = 60;

/**
 * Daily PII purge cron.
 *
 * The `anonymizeAndDeleteCustomer` action (PR 32) clears name/email/phone/
 * notes on the customers row itself, but historical PII still lives on
 * `communication_log` rows (the customer's email or phone is stored as
 * `recipient`, the message subject and a body preview are stored
 * verbatim). Those should be scrubbed once the customer has been deleted
 * long enough that the audit value of the original message has expired.
 *
 * Retention policy: 90 days after `customers.deleted_at`. That window
 * keeps the data around long enough for the operator to investigate
 * billing or dispute issues that surface shortly after deletion, then
 * scrubs it. Configurable via `PII_PURGE_RETENTION_DAYS`.
 *
 * Idempotent: scrubbing an already-scrubbed row is a no-op since the
 * `WHERE` clause filters out rows whose `recipient` has already been
 * replaced with the redaction marker.
 */
const REDACTED = "[purged]";
const DEFAULT_RETENTION_DAYS = 90;

function getRetentionDays(): number {
  const raw = process.env.PII_PURGE_RETENTION_DAYS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const retentionDays = getRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();

  // Find soft-deleted customers whose deletion is past the retention window.
  // The customer row itself was already anonymised by anonymizeAndDeleteCustomer;
  // we're cleaning up the trailing PII in communication_log only.
  const { data: targets, error: targetsError } = await admin
    .from("customers")
    .select("id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff);

  if (targetsError) {
    await logAppError({
      source: "cron.pii_purge",
      message: `Failed to query expired customers: ${targetsError.message}`,
    });
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  const customerIds = (targets ?? []).map((c) => c.id);
  if (customerIds.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No customers past retention window.",
      retentionDays,
      cutoff,
      customersProcessed: 0,
      logsScrubbed: 0,
    });
  }

  // Scrub PII fields on every matching communication_log row, but only
  // rows that haven't already been scrubbed (recipient != REDACTED) so
  // the cron is genuinely idempotent and the returned count reflects
  // *new* work.
  const { data: scrubbed, error: scrubError } = await admin
    .from("communication_log")
    .update({
      recipient: REDACTED,
      subject: REDACTED,
      body_preview: null,
      metadata: {},
    })
    .in("customer_id", customerIds)
    .neq("recipient", REDACTED)
    .select("id");

  if (scrubError) {
    await logAppError({
      source: "cron.pii_purge",
      message: `communication_log scrub failed: ${scrubError.message}`,
      context: { customerIds: customerIds.length },
    });
    return NextResponse.json({ error: "Scrub failed" }, { status: 500 });
  }

  const logsScrubbed = scrubbed?.length ?? 0;

  await logAppEvent({
    source: "cron.pii_purge",
    action: "scrub",
    status: "success",
    metadata: {
      retentionDays,
      cutoff,
      customersProcessed: customerIds.length,
      logsScrubbed,
    },
  });

  return NextResponse.json({
    ok: true,
    retentionDays,
    cutoff,
    customersProcessed: customerIds.length,
    logsScrubbed,
  });
}

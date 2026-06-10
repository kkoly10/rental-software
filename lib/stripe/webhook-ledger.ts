import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type WebhookClaimOutcome =
  | { kind: "claimed"; attempt: number }
  | { kind: "duplicate"; attempt: number } // already succeeded — safe to drop
  | { kind: "retry_exhausted"; attempt: number } // failed too many times; do not reprocess
  | { kind: "ledger_unavailable" }; // dedup table can't be read/written — fall open

/**
 * Caps consecutive retries on the same event id. Five is plenty for a
 * flaky downstream that recovers within Stripe's standard retry window
 * (~3 days, exponential) — and stops a poison-pill event from cycling
 * forever and pinning a Lambda.
 */
const MAX_ATTEMPTS = 5;

/**
 * Tier-2 launch hardening — atomic claim/release for the Stripe
 * webhook ledger. The old handler ran `INSERT … ON DUPLICATE → 23505`
 * then DELETE'd the row on handler failure. Concurrent retries could
 * race: A inserts, A starts handler, A sends customer email, A 5xxs,
 * A's catch block DELETEs the claim — and B is now free to run the
 * same handler and send the SAME email again. The unique index on
 * `payments (order_id, provider_payment_id)` saved the money row;
 * emails / notifications / Sentry calls had no such guard.
 *
 * Fix: never delete. The row IS the audit trail. State machine:
 *   - INSERT new row with status=claimed, attempt=1
 *   - on conflict, re-claim only if status=failed AND attempt<MAX —
 *     UPDATE flips it back to claimed and bumps the counter
 *   - succeeded → return duplicate (the true idempotent case)
 *   - failed at MAX → return retry_exhausted (operator surfaces it)
 *
 * Caller MUST follow up with markWebhookEventSucceeded or
 * markWebhookEventFailed, exactly once per "claimed" outcome.
 */
export async function claimWebhookEvent(
  admin: Admin,
  eventId: string,
  eventType: string,
): Promise<WebhookClaimOutcome> {
  // Try the happy path first — fresh event, fresh row.
  const { error: insertError } = await admin
    .from("stripe_webhook_events")
    .insert({
      event_id: eventId,
      event_type: eventType,
      processing_status: "claimed",
      attempt_count: 1,
    });

  if (!insertError) {
    return { kind: "claimed", attempt: 1 };
  }

  if ((insertError as { code?: string }).code !== "23505") {
    // Ledger genuinely unavailable (RLS, connection, etc). Caller
    // falls open and processes the event — better a possible
    // duplicate than a dropped charge confirmation.
    console.error(
      "[stripe-webhook] claim INSERT failed:",
      insertError.message,
    );
    return { kind: "ledger_unavailable" };
  }

  // Row already exists — inspect status to decide.
  const { data: existing, error: readError } = await admin
    .from("stripe_webhook_events")
    .select("processing_status, attempt_count")
    .eq("event_id", eventId)
    .maybeSingle();

  if (readError || !existing) {
    console.error(
      "[stripe-webhook] post-conflict read failed:",
      readError?.message ?? "no row",
    );
    return { kind: "ledger_unavailable" };
  }

  const existingStatus = existing.processing_status as
    | "claimed"
    | "succeeded"
    | "failed";
  const existingAttempts = Number(existing.attempt_count ?? 1);

  if (existingStatus === "succeeded") {
    return { kind: "duplicate", attempt: existingAttempts };
  }
  if (existingStatus === "claimed") {
    // Another worker has this in flight. Stripe will retry on the
    // next non-2xx; until then we treat it as a duplicate so we
    // don't race the in-flight handler.
    return { kind: "duplicate", attempt: existingAttempts };
  }
  if (existingAttempts >= MAX_ATTEMPTS) {
    return { kind: "retry_exhausted", attempt: existingAttempts };
  }

  // status='failed' AND attempt < cap — re-claim. The .eq guards make
  // it a true TOCTOU-safe transition: if another worker re-claimed
  // first, our UPDATE matches no rows and we treat it as duplicate.
  const nextAttempt = existingAttempts + 1;
  const { data: updated, error: updateError } = await admin
    .from("stripe_webhook_events")
    .update({
      processing_status: "claimed",
      attempt_count: nextAttempt,
      last_error: null,
      finished_at: null,
    })
    .eq("event_id", eventId)
    .eq("processing_status", "failed")
    .eq("attempt_count", existingAttempts)
    .select("event_id");

  if (updateError) {
    console.error(
      "[stripe-webhook] re-claim UPDATE failed:",
      updateError.message,
    );
    return { kind: "ledger_unavailable" };
  }
  if (!updated || updated.length === 0) {
    // Someone else re-claimed between our read and write.
    return { kind: "duplicate", attempt: existingAttempts };
  }

  return { kind: "claimed", attempt: nextAttempt };
}

export async function markWebhookEventSucceeded(
  admin: Admin,
  eventId: string,
): Promise<void> {
  const { error } = await admin
    .from("stripe_webhook_events")
    .update({
      processing_status: "succeeded",
      last_error: null,
      finished_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);
  if (error) {
    // Best-effort — at-least-once delivery is acceptable; the next
    // attempt will hit the duplicate branch via the payments unique
    // index and the orderRecord check.
    console.error(
      "[stripe-webhook] mark-succeeded failed:",
      error.message,
    );
  }
}

export async function markWebhookEventFailed(
  admin: Admin,
  eventId: string,
  reason: string,
): Promise<void> {
  const truncated = reason.length > 2000 ? reason.slice(0, 2000) : reason;
  const { error } = await admin
    .from("stripe_webhook_events")
    .update({
      processing_status: "failed",
      last_error: truncated,
      finished_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);
  if (error) {
    console.error("[stripe-webhook] mark-failed failed:", error.message);
  }
}

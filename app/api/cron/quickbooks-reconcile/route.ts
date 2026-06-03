import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/security/cron-auth";
import { syncOrderToQuickBooks } from "@/lib/integrations/quickbooks/sync";
import { shouldSkipSyncForBackoff } from "@/lib/integrations/sync-backoff";

export const maxDuration = 60;

/**
 * Daily QuickBooks reconcile cron (Sprint 2).
 *
 * For each org with a connected QBO account, find orders that:
 *   - Have a sync row in `failed` or `stale` status (or no sync row
 *     at all, for orders that landed in `delivered` while QBO was
 *     disconnected)
 *   - Are in a "ready to invoice" status (delivered / completed)
 *   - Were last attempted more than 1h ago (so we don't hammer Intuit
 *     on rapid-fire failures)
 *
 * Re-runs `syncOrderToQuickBooks` on each. The action itself is
 * idempotent — already-synced orders short-circuit to `noop`.
 *
 * Caps:
 *   - 100 orders per org per run
 *   - 60s total runtime (Vercel cron envelope)
 */
export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: connectedOrgs, error: orgsErr } = await supabase
    .from("organizations")
    .select("id")
    .not("qbo_realm_id", "is", null)
    .is("deleted_at", null);

  if (orgsErr) {
    return NextResponse.json({ ok: false, reason: "orgs_query_failed", detail: orgsErr.message }, { status: 500 });
  }

  const summary: {
    orgId: string;
    attempted: number;
    succeeded: number;
    failed: number;
    skippedBackoff: number;
    skippedMaxAttempts: number;
  }[] = [];

  for (const org of connectedOrgs ?? []) {
    const orgId = org.id as string;
    let attempted = 0;
    let succeeded = 0;
    let failed = 0;
    let skippedBackoff = 0;
    let skippedMaxAttempts = 0;

    // Candidates: orders in a paid/closed status that don't yet have
    // a successful sync row, or whose last attempt was more than an
    // hour ago. We use a LEFT JOIN via a separate query because
    // PostgREST's nested-resource semantics don't expose a clean
    // "missing right side" filter.

    const { data: orders } = await supabase
      .from("orders")
      .select("id, updated_at")
      .eq("organization_id", orgId)
      .in("order_status", ["delivered", "completed"])
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (!orders || orders.length === 0) continue;

    const { data: syncRows } = await supabase
      .from("quickbooks_invoice_sync")
      .select("order_id, sync_status, last_attempted_at, attempts")
      .eq("organization_id", orgId)
      .in("order_id", orders.map((o) => o.id as string));

    const syncByOrder = new Map<
      string,
      { status: string; lastAttempt: string; attempts: number }
    >();
    for (const row of syncRows ?? []) {
      syncByOrder.set(row.order_id as string, {
        status: row.sync_status as string,
        lastAttempt: row.last_attempted_at as string,
        attempts: (row.attempts as number | null) ?? 0,
      });
    }

    for (const order of orders) {
      const sync = syncByOrder.get(order.id as string);
      if (sync) {
        if (sync.status === "synced") continue;
        // Exponential backoff: 1h → 2h → 4h → 8h → 16h → 24h (cap),
        // then give up entirely at MAX_SYNC_ATTEMPTS. Replaces the
        // flat 1h retry that would otherwise hammer Intuit for an
        // order that's never going to succeed (bad data, revoked
        // perms, etc.).
        const decision = shouldSkipSyncForBackoff(sync.attempts, sync.lastAttempt);
        if (decision.skip) {
          if (decision.reason === "max_attempts") skippedMaxAttempts += 1;
          else skippedBackoff += 1;
          continue;
        }
      }
      attempted += 1;
      const result = await syncOrderToQuickBooks(supabase, orgId, order.id as string);
      if (result.ok) succeeded += 1;
      else failed += 1;
      // Stop early if we're nudging the runtime cap.
      if (attempted >= 100) break;
    }

    summary.push({ orgId, attempted, succeeded, failed, skippedBackoff, skippedMaxAttempts });
  }

  return NextResponse.json({ ok: true, summary });
}

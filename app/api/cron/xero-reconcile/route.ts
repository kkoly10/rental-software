import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/security/cron-auth";
import { syncOrderToXero } from "@/lib/integrations/xero/sync";
import { shouldSkipSyncForBackoff } from "@/lib/integrations/sync-backoff";

export const maxDuration = 60;

/**
 * Daily Xero reconcile cron — same shape as the QBO reconcile, just
 * targets the Xero-connected orgs and the xero_invoice_sync table.
 */
export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: connectedOrgs } = await supabase
    .from("organizations")
    .select("id")
    .not("xero_tenant_id", "is", null)
    .is("deleted_at", null);

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
      .from("xero_invoice_sync")
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
        // Same exponential backoff as QBO reconcile — see comment in
        // app/api/cron/quickbooks-reconcile/route.ts for the rationale.
        const decision = shouldSkipSyncForBackoff(sync.attempts, sync.lastAttempt);
        if (decision.skip) {
          if (decision.reason === "max_attempts") skippedMaxAttempts += 1;
          else skippedBackoff += 1;
          continue;
        }
      }
      attempted += 1;
      const result = await syncOrderToXero(supabase, orgId, order.id as string);
      if (result.ok) succeeded += 1;
      else failed += 1;
      if (attempted >= 100) break;
    }
    summary.push({ orgId, attempted, succeeded, failed, skippedBackoff, skippedMaxAttempts });
  }
  return NextResponse.json({ ok: true, summary });
}

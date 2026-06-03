import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/security/cron-auth";
import { expandSeriesInternal } from "@/lib/orders/series";

export const maxDuration = 60;

/**
 * Sprint 3 — daily expansion of active recurring series.
 *
 * Picks up where the eager-expand on series-create left off. For each
 * active series whose `last_generated_through` is within a reasonable
 * window of the horizon, generate new child orders. Idempotent — re-
 * running on a series with nothing to do is a cheap no-op.
 *
 * Why we need it:
 *   - Indefinite series ("rent every Saturday, no end date") never
 *     hit a terminus, so the eager-expand only covers ~2 years out.
 *     The cron rolls the horizon forward as time passes.
 *   - Paused-then-resumed series catch up missed cycles.
 *   - A series whose template order was deleted mid-expansion gets
 *     re-attempted once the operator fixes the template.
 */
export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: series, error } = await supabase
    .from("order_series")
    .select("id, organization_id")
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(500);

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "series_query_failed", detail: error.message },
      { status: 500 },
    );
  }

  let totalGenerated = 0;
  let processed = 0;
  for (const row of series ?? []) {
    const result = await expandSeriesInternal(
      supabase,
      row.organization_id as string,
      row.id as string,
    );
    totalGenerated += result.generated;
    processed += 1;
  }

  return NextResponse.json({
    ok: true,
    processed,
    totalGenerated,
  });
}

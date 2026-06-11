import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/security/cron-auth";

export const maxDuration = 60;

/**
 * Marketplace hold expiry (spec §10): every 5 minutes, flip stale
 * checkout/verification/payment holds to `expired` so the inventory
 * frees up. Standby promotion notifications layer on later — the
 * standby queue never blocks inventory, so expiry alone restores
 * availability immediately.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("market_expire_stale_holds");

  if (error) {
    return NextResponse.json({ error: "expiry failed" }, { status: 500 });
  }

  // §19 auto-decision "no seller response by SLA": requests older than
  // 24h auto-cancel — the renter was promised they pay nothing if the
  // seller never answers.
  const slaCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: timedOut } = await admin
    .from("market_bookings")
    .update({ state: "cancelled", updated_at: new Date().toISOString() })
    .eq("state", "pending_seller_approval")
    .lt("created_at", slaCutoff)
    .select("id");

  // awaiting_payment bookings whose hold has expired lose the slot —
  // cancel them so the renter sees an honest state instead of a dead
  // Pay button. 48h lookback so a stalled cron run can't strand rows.
  const { data: expiredHolds } = await admin
    .from("market_reservation_holds")
    .select("id")
    .eq("state", "expired")
    .gt("updated_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .limit(500);
  let paymentTimeouts = 0;
  if (expiredHolds && expiredHolds.length > 0) {
    const { data: cancelled } = await admin
      .from("market_bookings")
      .update({ state: "cancelled", updated_at: new Date().toISOString() })
      .eq("state", "awaiting_payment")
      .in(
        "hold_id",
        expiredHolds.map((h) => h.id),
      )
      .select("id");
    paymentTimeouts = cancelled?.length ?? 0;
  }

  return NextResponse.json({
    ok: true,
    expired: data ?? 0,
    sellerSlaCancelled: timedOut?.length ?? 0,
    paymentTimeouts,
  });
}

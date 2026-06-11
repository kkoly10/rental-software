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

  return NextResponse.json({ ok: true, expired: data ?? 0 });
}

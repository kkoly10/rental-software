import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/security/cron-auth";

export const maxDuration = 60;

/**
 * §27 bridge consumer (every 5 min): drains the marketplace outbox
 * into operator fulfillment projections. Idempotent — projections
 * upsert on booking_id, so replaying a consumed-but-uncommitted batch
 * is safe, and a dead consumer only delays (never loses) work.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const { data: events } = await admin
    .from("market_bridge_outbox")
    .select("id, event, booking_id")
    .is("consumed_at", null)
    .order("id", { ascending: true })
    .limit(100);

  let projected = 0;
  for (const e of events ?? []) {
    if (e.event === "marketplace.booking.confirmed") {
      const { data: b } = await admin
        .from("market_bookings")
        .select(
          "id, organization_id, quantity, starts_at, ends_at, prep_buffer_minutes, recovery_buffer_minutes, market_listings ( title )",
        )
        .eq("id", e.booking_id)
        .maybeSingle();
      if (b) {
        const starts = new Date(b.starts_at);
        const ends = new Date(b.ends_at);
        await admin.from("market_fulfillment_projections").upsert(
          {
            booking_id: b.id,
            organization_id: b.organization_id,
            listing_title:
              (b.market_listings as unknown as { title: string } | null)?.title ??
              "Marketplace rental",
            quantity: b.quantity,
            starts_at: b.starts_at,
            ends_at: b.ends_at,
            prep_at: new Date(starts.getTime() - b.prep_buffer_minutes * 60_000).toISOString(),
            recovery_until: new Date(ends.getTime() + b.recovery_buffer_minutes * 60_000).toISOString(),
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "booking_id" },
        );
        projected++;
      }
    } else {
      const status = e.event === "marketplace.booking.cancelled" ? "cancelled" : "completed";
      await admin
        .from("market_fulfillment_projections")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("booking_id", e.booking_id);
    }

    await admin
      .from("market_bridge_outbox")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", e.id);
  }

  return NextResponse.json({ ok: true, consumed: events?.length ?? 0, projected });
}

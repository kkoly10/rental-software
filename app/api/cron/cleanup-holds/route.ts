import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";

/**
 * Cron job: Clean up expired availability holds from abandoned checkouts.
 *
 * Runs every 15 minutes via Vercel cron. Deletes availability_blocks where
 * expires_at is in the past, releasing inventory that customers never paid for.
 *
 * Also cancels the associated orders that were never paid (still "awaiting_deposit")
 * so operators aren't confused by ghost orders.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // Find expired holds (checkout_hold blocks past their expiration)
  const { data: expiredBlocks, error: fetchError } = await admin
    .from("availability_blocks")
    .select("id, source_order_id")
    .eq("block_type", "checkout_hold")
    .lt("expires_at", now);

  if (fetchError) {
    console.error("Failed to fetch expired holds:", fetchError.message);
    return NextResponse.json(
      { error: "Failed to fetch expired holds" },
      { status: 500 }
    );
  }

  if (!expiredBlocks || expiredBlocks.length === 0) {
    return NextResponse.json({ released: 0 });
  }

  const blockIds = expiredBlocks.map((b) => b.id);
  const orderIds = [
    ...new Set(
      expiredBlocks.map((b) => b.source_order_id).filter(Boolean) as string[]
    ),
  ];

  // Delete the expired availability blocks
  const { error: deleteError } = await admin
    .from("availability_blocks")
    .delete()
    .in("id", blockIds);

  if (deleteError) {
    console.error("Failed to delete expired holds:", deleteError.message);
  }

  // Cancel associated orders that are still awaiting deposit (never paid)
  if (orderIds.length > 0) {
    await admin
      .from("orders")
      .update({ order_status: "cancelled" })
      .in("id", orderIds)
      .eq("order_status", "awaiting_deposit");
  }

  console.log(
    `Cleanup: released ${blockIds.length} expired holds, checked ${orderIds.length} orders`
  );

  return NextResponse.json({
    released: blockIds.length,
    ordersChecked: orderIds.length,
  });
}

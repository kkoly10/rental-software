"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type AvailabilityBlock = {
  id: string;
  productId: string;
  productName: string;
  blockType: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  orderId: string | null;
  orderNumber: string | null;
};

/**
 * Get all availability blocks for the next N days.
 */
export async function getUpcomingBlocks(days: number = 30): Promise<AvailabilityBlock[]> {
  if (!hasSupabaseEnv()) {
    return [
      {
        id: "demo-1",
        productId: "p1",
        productName: "Tropical Bounce House",
        blockType: "order_hold",
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        reason: "Reserved through checkout",
        orderId: "o1",
        orderNumber: "ORD-2401",
      },
      {
        id: "demo-2",
        productId: "p2",
        productName: "Water Slide Combo",
        blockType: "manual_hold",
        startsAt: new Date(Date.now() + 86400000 * 3).toISOString(),
        endsAt: new Date(Date.now() + 86400000 * 4).toISOString(),
        reason: "Maintenance scheduled",
        orderId: null,
        orderNumber: null,
      },
    ];
  }

  const ctx = await getOrgContext();
  if (!ctx) return [];

  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const future = new Date(now);
  future.setDate(future.getDate() + days);

  const { data: blocks } = await supabase
    .from("availability_blocks")
    .select(`
      id, product_id, block_type, starts_at, ends_at, reason, source_order_id,
      products(name),
      orders(order_number)
    `)
    .eq("organization_id", ctx.organizationId)
    .gte("ends_at", now.toISOString())
    .lte("starts_at", future.toISOString())
    .order("starts_at", { ascending: true });

  return (blocks ?? []).map((b) => {
    const product = b.products as unknown as { name: string } | null;
    const order = b.orders as unknown as { order_number: string } | null;

    return {
      id: b.id,
      productId: b.product_id,
      productName: product?.name ?? "Unknown product",
      blockType: b.block_type,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      reason: b.reason ?? "",
      orderId: b.source_order_id,
      orderNumber: order?.order_number ?? null,
    };
  });
}

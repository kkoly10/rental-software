import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAvailabilityWindowForDate } from "@/lib/availability/window";

/**
 * Reserve availability for a checkout order.
 *
 * For website checkouts (source = "checkout"), a temporary hold is created
 * with a 30-minute expiration. The hold is converted to permanent when the
 * Stripe webhook confirms payment. If the customer abandons checkout, the
 * cron job (/api/cron/cleanup-holds) releases the expired hold.
 *
 * For dashboard-created orders, the hold is permanent immediately (no expiration).
 */
export async function reserveProductAvailabilityBlock(options: {
  organizationId: string;
  productId: string;
  orderId: string;
  eventDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  rentalEndDate?: string | null;
  source?: "checkout" | "dashboard";
}) {
  const window = getAvailabilityWindowForDate(
    options.eventDate,
    options.startTime,
    options.endTime,
    options.rentalEndDate
  );
  if (!window) {
    return { ok: true } as const;
  }

  const isCheckout = options.source === "checkout";
  const supabase = await createSupabaseServerClient();

  // Checkout holds expire after 30 minutes; dashboard holds are permanent
  const expiresAt = isCheckout
    ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
    : null;

  // Atomic check-and-insert via DB function: advisory lock on (org, product)
  // eliminates the TOCTOU race between the JS-level availability check and
  // the actual block insert.
  const { data, error } = await supabase.rpc("reserve_availability_if_available", {
    p_organization_id: options.organizationId,
    p_product_id: options.productId,
    p_block_type: isCheckout ? "checkout_hold" : "order_hold",
    p_starts_at: window.startsAt,
    p_ends_at: window.endsAt,
    p_reason: isCheckout ? "Temporary hold during checkout" : "Reserved through dashboard",
    p_source_order_id: options.orderId,
    p_expires_at: expiresAt,
  });

  if (error) {
    return { ok: false, message: error.message } as const;
  }

  const result = data as { ok: boolean; reason?: string };
  if (!result.ok) {
    return { ok: false, message: result.reason ?? "Unable to reserve availability." } as const;
  }

  return { ok: true } as const;
}

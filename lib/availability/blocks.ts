import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAvailabilityWindowForDate } from "@/lib/availability/window";

export async function reserveProductAvailabilityBlock(options: {
  organizationId: string;
  productId: string;
  orderId: string;
  eventDate?: string | null;
}) {
  const window = getAvailabilityWindowForDate(options.eventDate);
  if (!window) {
    return { ok: true } as const;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("availability_blocks").insert({
    organization_id: options.organizationId,
    product_id: options.productId,
    block_type: "order_hold",
    starts_at: window.startsAt,
    ends_at: window.endsAt,
    reason: "Reserved through checkout",
    source_order_id: options.orderId,
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
    } as const;
  }

  return { ok: true } as const;
}

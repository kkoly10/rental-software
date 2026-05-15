import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAvailabilityWindowForDate } from "@/lib/availability/window";

export type AvailabilityCheckResult = {
  available: boolean;
  reason?: string;
  assetCapacity: number;
  reservedCount: number;
  startsAt?: string;
  endsAt?: string;
};

export async function checkProductAvailability(options: {
  organizationId: string;
  productId: string;
  eventDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}): Promise<AvailabilityCheckResult> {
  const window = getAvailabilityWindowForDate(options.eventDate, options.startTime, options.endTime);

  if (!window) {
    return {
      available: true,
      assetCapacity: 0,
      reservedCount: 0,
    };
  }

  const supabase = await createSupabaseServerClient();

  const now = new Date().toISOString();

  const [{ count: assetCount }, { count: overlappingCount }] = await Promise.all([
    supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", options.organizationId)
      .eq("product_id", options.productId)
      .is("deleted_at", null)
      .in("operational_status", ["ready", "available", "active"]),
    // Count overlapping blocks, excluding any that have already expired
    supabase
      .from("availability_blocks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", options.organizationId)
      .eq("product_id", options.productId)
      .lt("starts_at", window.endsAt)
      .gt("ends_at", window.startsAt)
      .or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);

  const assetCapacity = assetCount ?? 0;
  const reservedCount = overlappingCount ?? 0;

  // A product with no asset records has no physical inventory — treat as unavailable.
  if (assetCapacity === 0 || reservedCount >= assetCapacity) {
    return {
      available: false,
      reason: assetCapacity === 0
        ? "This item is not currently available for booking."
        : "This rental is already reserved for the selected date.",
      assetCapacity,
      reservedCount,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
    };
  }

  return {
    available: true,
    assetCapacity,
    reservedCount,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
  };
}

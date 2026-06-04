import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getAvailabilityWindowForDate } from "@/lib/availability/window";
import { BOOKABLE_ASSET_STATUSES } from "@/lib/assets/operational-status";

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
  rentalEndDate?: string | null;
}): Promise<AvailabilityCheckResult> {
  const window = getAvailabilityWindowForDate(
    options.eventDate,
    options.startTime,
    options.endTime,
    options.rentalEndDate
  );

  if (!window) {
    return {
      available: true,
      assetCapacity: 0,
      reservedCount: 0,
    };
  }

  // Use the admin client when available. The customer-facing checkout path
  // calls this with no authenticated session, so the cookie-bound RLS-scoped
  // client returns 0 for assets (the "Org members can manage assets" policy
  // requires get_user_org_ids() to contain the row's organization_id) and
  // every storefront purchase fails at "not currently available for booking".
  // Org isolation is still enforced explicitly via the .eq("organization_id")
  // filter below — admin just lets the count actually run.
  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  const now = new Date().toISOString();

  // Fetch the bookable asset IDs (not just a count) so we can subtract any
  // assets currently held by an open maintenance record. Decision 2.4 —
  // assets with an open maintenance_record (status='open') are unavailable
  // until the operator closes the record. Matches Booqable / EZRentOut
  // "schedule downtime blocks availability" default.
  const [{ data: bookableAssets }, { count: overlappingCount }] =
    await Promise.all([
      supabase
        .from("assets")
        .select("id")
        .eq("organization_id", options.organizationId)
        .eq("product_id", options.productId)
        .is("deleted_at", null)
        .in("operational_status", BOOKABLE_ASSET_STATUSES as unknown as string[]),
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

  let assetCapacity = bookableAssets?.length ?? 0;
  if (assetCapacity > 0 && bookableAssets) {
    const assetIds = bookableAssets.map((a) => String(a.id));
    const { data: maintAssets } = await supabase
      .from("maintenance_records")
      .select("asset_id")
      .eq("organization_id", options.organizationId)
      .in("status", ["open", "in_progress"])
      .in("asset_id", assetIds);
    if (maintAssets && maintAssets.length > 0) {
      const inMaintenance = new Set(
        maintAssets.map((m) => String(m.asset_id))
      );
      assetCapacity = assetIds.filter((id) => !inMaintenance.has(id)).length;
    }
  }
  const reservedCount = overlappingCount ?? 0;

  // A product with no asset records has no physical inventory — treat as
  // unavailable. Same applies when every asset is currently held by an open
  // maintenance record (decision 2.4).
  if (assetCapacity === 0 || reservedCount >= assetCapacity) {
    return {
      available: false,
      reason: assetCapacity === 0
        ? "This item is currently under service and not available to book."
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

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getAvailabilityWindowForDate } from "@/lib/availability/window";
import { BOOKABLE_ASSET_STATUSES } from "@/lib/assets/operational-status";
import { hasAvailableCapacity } from "@/lib/availability/capacity";

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
  /**
   * Units the caller intends to reserve. Per-unit products book many
   * units per order (e.g. 200 chairs); a default of 1 preserves the
   * historical "is there any capacity left" behavior for serialized
   * single-unit rentals. The atomic reserve RPC enforces the same
   * math authoritatively — this is the matching pre-check for the UI.
   */
  requestedQuantity?: number;
}): Promise<AvailabilityCheckResult> {
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

  // PR-1 #3 — pull setup/breakdown buffer so the window extends to
  // cover crew + inventory time around the event itself. Without
  // this, a Saturday tent with 4h setup_minutes_before doesn't
  // block Friday evening, letting the operator double-book crew.
  const { data: productMeta } = await supabase
    .from("products")
    .select("setup_minutes_before, breakdown_minutes_after, quantity_on_hand")
    .eq("id", options.productId)
    .eq("organization_id", options.organizationId)
    .maybeSingle();

  const window = getAvailabilityWindowForDate(
    options.eventDate,
    options.startTime,
    options.endTime,
    options.rentalEndDate,
    productMeta?.setup_minutes_before ?? 0,
    productMeta?.breakdown_minutes_after ?? 0
  );

  if (!window) {
    return {
      available: true,
      assetCapacity: 0,
      reservedCount: 0,
    };
  }

  const now = new Date().toISOString();

  // Fetch the bookable asset IDs (not just a count) so we can subtract any
  // assets currently held by an open maintenance record. Decision 2.4 —
  // assets with an open maintenance_record (status='open') are unavailable
  // until the operator closes the record. Matches Booqable / EZRentOut
  // "schedule downtime blocks availability" default.
  // A pooled count (quantity_on_hand) wins when the operator set one:
  // bulk products (e.g. 500 chairs) are sold by the unit and usually
  // tracked as a single pool, not N asset rows. NULL falls back to the
  // historical asset-row capacity below.
  const quantityOnHand =
    typeof (productMeta as { quantity_on_hand?: unknown })?.quantity_on_hand === "number"
      ? ((productMeta as { quantity_on_hand?: unknown }).quantity_on_hand as number)
      : null;

  const [{ data: bookableAssets }, { data: overlappingBlocks }] =
    await Promise.all([
      supabase
        .from("assets")
        .select("id")
        .eq("organization_id", options.organizationId)
        .eq("product_id", options.productId)
        .is("deleted_at", null)
        .in("operational_status", BOOKABLE_ASSET_STATUSES as unknown as string[]),
      // Overlapping non-expired blocks. Select the quantity so we can sum
      // units consumed (per-unit products book many units per block),
      // not just count rows.
      supabase
        .from("availability_blocks")
        .select("quantity")
        .eq("organization_id", options.organizationId)
        .eq("product_id", options.productId)
        .lt("starts_at", window.endsAt)
        .gt("ends_at", window.startsAt)
        .or(`expires_at.is.null,expires_at.gt.${now}`),
    ]);

  let assetCapacity: number;
  if (quantityOnHand !== null) {
    assetCapacity = quantityOnHand;
  } else {
    assetCapacity = bookableAssets?.length ?? 0;
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
  }
  const reservedCount = (overlappingBlocks ?? []).reduce(
    (sum, b) =>
      sum +
      (typeof (b as { quantity?: unknown }).quantity === "number"
        ? ((b as { quantity?: unknown }).quantity as number)
        : 1),
    0
  );

  const requestedQuantity = Math.max(1, Math.trunc(options.requestedQuantity ?? 1));

  // A product with no inventory has nothing to book — treat as
  // unavailable. Same applies when every asset is currently held by an open
  // maintenance record (decision 2.4), or when the requested units would
  // exceed the units still free in the window. Shared pure helper keeps
  // this arithmetic identical to the atomic reserve RPC.
  if (
    !hasAvailableCapacity({
      capacity: assetCapacity,
      reserved: reservedCount,
      requested: requestedQuantity,
    })
  ) {
    return {
      available: false,
      reason: assetCapacity === 0
        ? (quantityOnHand !== null
            ? "This item is not currently available for booking."
            : "This item is currently under service and not available to book.")
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

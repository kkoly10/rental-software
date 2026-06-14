/**
 * Phase 3a — multi-item cart groundwork.
 *
 * Behavior-preserving extraction of the per-item order_items INSERT
 * block that used to live inline in `createCheckoutOrder`
 * (lib/checkout/actions.ts, formerly ~lines 1366–1492). This inserts
 * ONE product's line items: the parent `rental` row, the `addon` child
 * rows (linked via parent_order_item_id), and the `damage_waiver` child
 * row.
 *
 * Behavior preserved exactly:
 *  - The parent insert is the only failable step; on its error the
 *    caller still owns the order/address/customer rollback + fail()
 *    response, so this helper returns `{ ok: false }` WITHOUT mutating
 *    anything and lets the caller run the identical cleanup it always
 *    did. The error is logged here with the same message/context.
 *  - The add-on and damage-waiver inserts are best-effort: a failure
 *    is logged (same messages/context) but does NOT roll back the
 *    order, identical to the original.
 */
import { logAppError } from "@/lib/observability/server";
import type { ResolvedAddonLine } from "@/lib/checkout/pricing-helpers";
import type { WaiverComputation } from "@/lib/checkout/damage-waiver";

/**
 * Minimal structural type for the Supabase client surface this helper
 * touches. Kept loose to accept both the admin client and the
 * cookie-bound server client, mirroring pricing-helpers.ts.
 */
type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

/** Inputs the line-item inserts read. Field names mirror the action's
 *  locals so the call site reads as a direct hand-off. */
export type InsertOneItemLinesInput = {
  organizationId: string;
  orderId: string;
  productId: string;
  productName: string;
  subtotal: number;
  itemRatePerDay: number | null;
  itemRentalDays: number | null;
  billedUnitsForLineItem: number | null;
  billedHoursForLineItem: number | null;
  attendantOverageHours: number | null;
  effectiveMode: "dry" | "wet" | null;
  resolvedVariantId: string | null;
  resolvedAddonLines: ResolvedAddonLine[];
  waiver: WaiverComputation;
};

/** Success: the parent line item was created. `parentItemId` may still
 *  be null if PostgREST didn't return the id (matches the original
 *  `parentItem?.id` guards on the child inserts). `errors` collects
 *  best-effort child-insert failures (already logged) for visibility. */
export type InsertOneItemLinesSuccess = {
  ok: true;
  parentItemId: string | null;
  errors: string[];
};

/** Failure: the parent insert errored. The caller performs the same
 *  order/address/customer rollback + fail() it always did; this carries
 *  the DB error message so the caller can log it in its own context. */
export type InsertOneItemLinesFailure = {
  ok: false;
  errorMessage: string;
};

export type InsertOneItemLinesResult =
  | InsertOneItemLinesSuccess
  | InsertOneItemLinesFailure;

/**
 * Insert the parent rental line + its add-on and damage-waiver child
 * rows for a single product. Behavior-identical to the inline block it
 * replaces; see file header for provenance.
 */
export async function insertOneItemLines(
  supabase: SupabaseLike,
  input: InsertOneItemLinesInput,
): Promise<InsertOneItemLinesResult> {
  const {
    organizationId: orgId,
    orderId,
    productId,
    productName,
    subtotal,
    itemRatePerDay,
    itemRentalDays,
    billedUnitsForLineItem,
    billedHoursForLineItem,
    attendantOverageHours,
    effectiveMode,
    resolvedVariantId,
    resolvedAddonLines,
    waiver,
  } = input;

  const errors: string[] = [];

  const { data: parentItem, error: itemError } = await supabase
    .from("order_items")
    .insert({
      order_id: orderId,
      product_id: productId,
      line_type: "rental",
      // Phase 2e.13 — quantity surfaces the unit count when the
      // product is priced per-unit so order summaries / pull sheets
      // show "200 chairs" instead of "1". Flat-day and per-hour
      // products still bill as a single line.
      quantity: billedUnitsForLineItem ?? 1,
      unit_price: itemRatePerDay ?? subtotal,
      line_total: subtotal,
      item_name_snapshot: productName,
      rental_days: itemRentalDays,
      rate_per_day: itemRatePerDay,
      // Sprint 6.0 — wet/dry choice the customer made on the
      // product-detail page. NULL when the product is single-mode or
      // the customer hit a non-mode-aware path; only ever 'dry'/'wet'
      // because effectiveMode is reconciled against
      // supports_modes above.
      selected_mode: effectiveMode,
      // Phase 2e.7b — actual hours billed for per-hour products
      // (after the minimum-floor logic). NULL for flat-day / per-day
      // products. Refund + dispute lookups read this directly.
      billed_hours: billedHoursForLineItem,
      // Phase 2e.13 — actual units billed for per-unit products
      // (after clamping / truncation). NULL for flat-day / per-hour
      // products. Refund + dispute lookups read this directly.
      billed_units: billedUnitsForLineItem,
      // Phase 2e.15 — onsite-attendant overage hours actually billed,
      // for refund / dispute lookups and post-event reconciliation.
      // NULL when capability is off or the event fits inside included
      // hours.
      attendant_overage_hours: attendantOverageHours,
      // Phase 2e.12 — variant the customer picked on the PDP. NULL
      // when no variant was selected or the id failed the
      // product-scoped lookup. The price delta has already been
      // added to subtotal / line_total above.
      selected_variant_id: resolvedVariantId,
    })
    .select("id")
    .single();

  if (itemError) {
    await logAppError({
      organizationId: orgId,
      source: "checkout.website",
      message: "Failed to create order item during checkout",
      context: { reason: itemError.message, orderId, productId },
    });
    return { ok: false, errorMessage: itemError.message };
  }

  // Phase 2e.10 — add-on child line items, linked back to the
  // parent via parent_order_item_id so refund / display can walk
  // the tree. Insert is best-effort: a failure here does NOT roll
  // back the order since the parent rental still bills correctly;
  // we log so an operator can manually reconcile.
  if (parentItem?.id && resolvedAddonLines.length > 0) {
    const childRows = resolvedAddonLines.map((line) => ({
      order_id: orderId,
      product_id: line.addonProductId,
      parent_order_item_id: parentItem.id,
      line_type: "addon",
      quantity: line.quantity,
      unit_price: line.basePriceCents / 100,
      line_total: line.lineTotalCents / 100,
      item_name_snapshot: line.name,
    }));
    const { error: addonError } = await supabase
      .from("order_items")
      .insert(childRows);
    if (addonError) {
      errors.push(addonError.message);
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to insert addon line items",
        context: {
          reason: addonError.message,
          orderId,
          parentItemId: parentItem.id,
          addonCount: childRows.length,
        },
      });
    }
  }

  // PR-2c — damage waiver as its own line so invoices and exports
  // show the customer agreed to the surcharge (rather than burying
  // it in the rental's unit_price). Best-effort like the add-ons:
  // the waiver dollars already live on orders.subtotal_amount, so
  // a failed insert is a reporting gap, not a billing error.
  if (parentItem?.id && waiver.amount > 0) {
    const { error: waiverItemError } = await supabase
      .from("order_items")
      .insert({
        order_id: orderId,
        parent_order_item_id: parentItem.id,
        line_type: "damage_waiver",
        quantity: 1,
        unit_price: waiver.amount,
        line_total: waiver.amount,
        item_name_snapshot: `Damage waiver (${(waiver.rateBps / 100).toFixed(2)}%)`,
      });
    if (waiverItemError) {
      errors.push(waiverItemError.message);
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to insert damage waiver line item",
        context: { parentItemId: parentItem.id, waiverAmount: waiver.amount },
      });
    }
  }

  return { ok: true, parentItemId: parentItem?.id ?? null, errors };
}

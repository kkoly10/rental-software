/**
 * Phase 3a — multi-item cart groundwork.
 *
 * Behavior-preserving extraction of the per-item pricing / resolution
 * block that used to live inline in `createCheckoutOrder`
 * (lib/checkout/actions.ts, formerly ~lines 470–847). This prices and
 * resolves ONE product: the single product lookup, the pricing
 * dispatch (per-unit / per-hour / per-day / flat), the onsite-attendant
 * overage, composition add-ons, the selected-variant delta, the wet
 * upcharge, and the damage waiver.
 *
 * The arithmetic is delegated to the SAME capability helpers the action
 * used (computePerUnitLineTotal, computePerHourLineTotal,
 * calculatePrice, computeAttendantOverage, computeDamageWaiver) — this
 * file only orchestrates and resolves DB rows. No money math was
 * re-implemented.
 *
 * The single early-return the original block had (the decision-2.9
 * "missing price" gate) is preserved as a discriminated `{ ok: false }`
 * result carrying the exact customer-facing message and the log event
 * the caller should emit, so the action keeps returning the identical
 * error shape.
 */
import { calculatePrice } from "../pricing/engine.ts";
import type { PricingRule } from "../pricing/types.ts";
import { computeDamageWaiver, type WaiverComputation } from "./damage-waiver.ts";

/**
 * Minimal structural type for the Supabase client surface this helper
 * touches. We keep it loose (the project mixes the admin client and the
 * cookie-bound server client) and rely on the same query chains the
 * original inline block used.
 */
type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

/** Per-item request, mirrors the fields the original block read off the
 *  form / parsed schema for the single product. */
export type ItemPricingRequest = {
  /** May be empty/undefined for a generic booking with no product; the
   *  helper then returns the zero-priced defaults, mirroring the
   *  original inline `if (productSlug)` guard. */
  productSlug: string | null | undefined;
  requestedMode: "dry" | "wet" | null;
  requestedUnits: number;
  requestedVariantId: string | null;
  requestedAddons: { addonProductId: string; quantity: number }[];
  eventDate: string | null | undefined;
  rentalEndDate: string | null | undefined;
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  /** True when the customer ticked the damage-waiver accept checkbox. */
  waiverAccepted: boolean;
};

/** A resolved add-on line, ready to be inserted as an `addon` child row. */
export type ResolvedAddonLine = {
  addonProductId: string;
  name: string;
  basePriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

/** Structured log payload the caller emits verbatim (preserving the
 *  original logAppEvent call) when pricing fails the missing-price gate. */
export type ItemPricingLogEvent = {
  action: string;
  status: "warning";
  metadata: Record<string, unknown>;
};

/** Successful pricing result — every field the action's downstream code
 *  (order insert, availability, line-item insert, summary) reads. */
export type ItemPricingSuccess = {
  ok: true;
  subtotal: number;
  productId: string | null;
  productName: string;
  itemRentalDays: number | null;
  itemRatePerDay: number | null;
  billedHoursForLineItem: number | null;
  billedUnitsForLineItem: number | null;
  attendantOverageHours: number | null;
  resolvedVariantId: string | null;
  variantPriceDeltaCents: number;
  resolvedAddonLines: ResolvedAddonLine[];
  effectiveMode: "dry" | "wet" | null;
  wetUpchargeApplied: number;
  waiver: WaiverComputation;
  // Product flags / capability state the action's downstream gates read.
  productSupportsModes: string[];
  productWetUpchargeCents: number | null;
  productVerticalSlug: string | null;
  productDamageWaiverBps: number | null;
  orderMinimumCapabilityActive: boolean;
  productMinimumOrderCents: number | null;
  productMinimumOrderQuantity: number | null;
};

/** Failure result — mirrors the action's early `fail(...)` for the
 *  missing-price gate. The caller maps `message` into `fail({ message })`
 *  and emits `logEvent` via logAppEvent, exactly as before. */
export type ItemPricingFailure = {
  ok: false;
  message: string;
  logEvent: ItemPricingLogEvent;
};

export type ItemPricingResult = ItemPricingSuccess | ItemPricingFailure;

/**
 * Price and resolve a single product item. Behavior-identical to the
 * inline block this replaces; see file header for provenance.
 */
export async function priceAndResolveOneItem(
  supabase: SupabaseLike,
  organizationId: string,
  request: ItemPricingRequest,
): Promise<ItemPricingResult> {
  const {
    productSlug,
    requestedMode,
    requestedUnits,
    requestedVariantId,
    requestedAddons,
    eventDate,
    rentalEndDate,
    startTime,
    endTime,
    waiverAccepted,
  } = request;

  // --- Outputs (defaults mirror the action's pre-block initializers). ---
  let subtotal = 0;
  let productId: string | null = null;
  let productName = "Rental booking";
  let itemRentalDays: number | null = null;
  let itemRatePerDay: number | null = null;
  let billedHoursForLineItem: number | null = null;
  let billedUnitsForLineItem: number | null = null;
  let productMinimumOrderCents: number | null = null;
  let productMinimumOrderQuantity: number | null = null;
  let orderMinimumCapabilityActive = false;
  let attendantOverageHours: number | null = null;
  let resolvedVariantId: string | null = null;
  let variantPriceDeltaCents = 0;
  let resolvedAddonLines: ResolvedAddonLine[] = [];
  let productSupportsModes: string[] = ["dry"];
  let productWetUpchargeCents: number | null = null;
  let productVerticalSlug: string | null = null;
  let productDamageWaiverBps: number | null = null;

  if (productSlug) {
    const { data: product } = await supabase
      .from("products")
      .select(
        "id, name, base_price, pricing_model, supports_modes, wet_upcharge_cents, capability_slugs, hourly_rate_cents, minimum_hours, unit_price_cents, minimum_order_quantity, attendant_included_hours, attendant_overage_cents_per_hour, damage_waiver_rate_bps, categories(minimum_order_cents, vertical)",
      )
      .eq("slug", productSlug)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .maybeSingle();

    if (product) {
      // PR-2b — vertical via the category embed (single or array
      // shape depending on the PostgREST relationship inference).
      const categoryJoin = (product as { categories?: unknown }).categories;
      const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] : categoryJoin;
      productVerticalSlug =
        typeof (categoryRow as { vertical?: unknown } | null)?.vertical === "string"
          ? ((categoryRow as { vertical: string }).vertical)
          : null;

      // PR-2c — damage waiver rate (bps).
      productDamageWaiverBps =
        typeof (product as { damage_waiver_rate_bps?: unknown }).damage_waiver_rate_bps === "number"
          ? ((product as { damage_waiver_rate_bps: number }).damage_waiver_rate_bps)
          : null;

      // Phase 2e.13 — capability slugs read before the pricing
      // validity check so per-unit products (which carry their rate
      // on unit_price_cents, not base_price) aren't rejected by the
      // decision-2.9 "missing price" gate.
      const productCapabilitySlugs = Array.isArray(
        (product as { capability_slugs?: unknown }).capability_slugs,
      )
        ? ((product as { capability_slugs?: unknown }).capability_slugs as string[])
        : [];
      const productUnitPriceCents =
        typeof (product as { unit_price_cents?: unknown }).unit_price_cents === "number"
          ? ((product as { unit_price_cents?: unknown }).unit_price_cents as number)
          : null;
      const isPerUnitProduct =
        productCapabilitySlugs.includes("pricing.per-unit") &&
        productUnitPriceCents !== null &&
        productUnitPriceCents > 0;

      // Phase 2e.14 — order-minimum capability. The product carries
      // the unit-count minimum (`minimum_order_quantity`); the dollar
      // minimum lives on the category (`minimum_order_cents`) since
      // operators commonly say "tables/chairs orders < $600 aren't
      // worth our delivery time" at the category level.
      orderMinimumCapabilityActive =
        productCapabilitySlugs.includes("order.minimum-order");
      if (orderMinimumCapabilityActive) {
        productMinimumOrderQuantity =
          typeof (product as { minimum_order_quantity?: unknown }).minimum_order_quantity === "number"
            ? ((product as { minimum_order_quantity?: unknown }).minimum_order_quantity as number)
            : null;
        const category = (product as { categories?: unknown }).categories as
          | { minimum_order_cents?: number | null }
          | null;
        productMinimumOrderCents =
          typeof category?.minimum_order_cents === "number"
            ? category.minimum_order_cents
            : null;
      }

      // Decision 2.9 — refuse checkout when a product has no price set,
      // instead of silently billing the magic $225 default. Matches the
      // WooCommerce default ("empty price → no Add-to-Cart button"). The
      // product itself stays browsable on the storefront so customers can
      // still request a quote for unusual items. Per-unit products
      // satisfy the gate via unit_price_cents instead of base_price.
      const rawBasePrice = product.base_price;
      const hasValidPrice =
        (typeof rawBasePrice === "number" && rawBasePrice > 0) ||
        isPerUnitProduct;
      if (!hasValidPrice) {
        return {
          ok: false,
          message:
            "Pricing isn't set for this item yet. Please contact us to confirm a quote before booking.",
          logEvent: {
            action: "missing_price_blocked",
            status: "warning",
            metadata: {
              product_slug: productSlug,
              product_id: product.id,
            },
          },
        };
      }
      const ratePerDay = Number(rawBasePrice);
      productId = product.id;
      productName = product.name ?? productSlug;
      // Sprint 6.0 — capture mode/upcharge under the same lookup so
      // the wet upcharge applies to whichever pricing branch
      // (flat_day or per_day) the product uses, and the eventual
      // order_items.selected_mode persistence has the value.
      productSupportsModes = (Array.isArray(product.supports_modes)
        ? product.supports_modes
        : ["dry"]) as string[];
      productWetUpchargeCents =
        typeof product.wet_upcharge_cents === "number"
          ? product.wet_upcharge_cents
          : null;

      // Phase 2e.7b — per-hour pricing branch (photo booths,
      // concessions, mechanical bulls, future AV). When the product
      // carries pricing.per-hour AND has a configured hourly rate,
      // compute the line total from the customer's event start/end
      // times via the shared computePerHourLineTotal helper. Below
      // the minimum_hours floor still bills the minimum block, so a
      // sub-minimum rental never undercharges.
      const productHourlyRateCents =
        typeof (product as { hourly_rate_cents?: unknown }).hourly_rate_cents === "number"
          ? ((product as { hourly_rate_cents?: unknown }).hourly_rate_cents as number)
          : null;
      const productMinimumHours =
        typeof (product as { minimum_hours?: unknown }).minimum_hours === "number"
          ? ((product as { minimum_hours?: unknown }).minimum_hours as number)
          : null;
      const isPerHourProduct =
        productCapabilitySlugs.includes("pricing.per-hour") &&
        productHourlyRateCents !== null;

      const pricingModel = product.pricing_model ?? "flat_day";
      if (isPerUnitProduct) {
        // Phase 2e.13 — per-unit pricing branch (tables, chairs,
        // dance-floor sections, future bulk-item verticals). The
        // customer picks a count on the PDP; line total = units ×
        // unit_price_cents via the shared computePerUnitLineTotal
        // helper, which clamps negatives to 0 and truncates fractions
        // so a crafted `units=-5` or `units=12.7` can't undercharge
        // or write a non-integer to billed_units.
        const { computePerUnitLineTotal } = await import(
          "../capabilities/pricing/per-unit.ts"
        );
        const perUnit = computePerUnitLineTotal({
          unitPriceCents: productUnitPriceCents ?? 0,
          units: requestedUnits,
        });
        subtotal = Number((perUnit.lineTotalCents / 100).toFixed(2));
        billedUnitsForLineItem = perUnit.billedUnits;
      } else if (isPerHourProduct) {
        const { computePerHourLineTotal } = await import(
          "../capabilities/pricing/per-hour.ts"
        );
        // Hours from "HH:MM" start + end. Falls back to the minimum
        // (or 1) when times aren't both set — the helper's min floor
        // then rounds the rental up to a billable block.
        const computeHours = (a: string, b: string): number => {
          if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b)) return 0;
          const [ah, am] = a.split(":").map(Number);
          const [bh, bm] = b.split(":").map(Number);
          const minutes = bh * 60 + bm - (ah * 60 + am);
          return minutes > 0 ? minutes / 60 : 0;
        };
        const requestedHours = computeHours(startTime ?? "", endTime ?? "");
        const perHour = computePerHourLineTotal({
          hourlyRateCents: productHourlyRateCents ?? 0,
          quantity: 1,
          hours: requestedHours,
          minimumHours: productMinimumHours,
        });
        subtotal = Number((perHour.lineTotalCents / 100).toFixed(2));
        billedHoursForLineItem = perHour.billedHours;
      } else if (pricingModel === "per_day" && eventDate && rentalEndDate && rentalEndDate >= eventDate) {
        // Centralised in lib/pricing/rental-days.ts so the storefront
        // summary (lib/data/checkout-pricing.ts) and this submit path
        // share one source of truth for day math (#4 — three-day,
        // $300/day product was showing $300 on the summary and $900
        // on the bill).
        const { computeRentalDays } = await import("../pricing/rental-days.ts");
        const days = computeRentalDays(eventDate, rentalEndDate);

        const { data: orgData } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", organizationId)
          .is("deleted_at", null)
          .maybeSingle();

        const orgSettings = (orgData?.settings as Record<string, unknown>) ?? {};
        const rules: PricingRule[] = (orgSettings.pricing_rules as PricingRule[] | undefined) ?? [];

        const priceCalc = calculatePrice(ratePerDay, rules, {
          eventDate,
          bookingDate: new Date().toISOString().split("T")[0],
          rentalDays: days,
          pricingModel: "per_day"
        });

        subtotal = priceCalc.finalPrice;
        itemRentalDays = days;
        itemRatePerDay = ratePerDay;
      } else {
        subtotal = ratePerDay;
      }

      // Phase 2e.15 — onsite-attendant overage. When the product
      // carries service.onsite-attendant and the customer's event
      // window exceeds attendant_included_hours, bill the overage
      // at attendant_overage_cents_per_hour. Helper clamps negatives
      // and rounds cents so an event ending before its start can't
      // crash or credit.
      if (
        productCapabilitySlugs.includes("service.onsite-attendant") &&
        startTime &&
        endTime
      ) {
        const includedHours =
          typeof (product as { attendant_included_hours?: unknown }).attendant_included_hours === "number"
            ? ((product as { attendant_included_hours?: unknown }).attendant_included_hours as number)
            : 0;
        const overageRateCents =
          typeof (product as { attendant_overage_cents_per_hour?: unknown }).attendant_overage_cents_per_hour === "number"
            ? ((product as { attendant_overage_cents_per_hour?: unknown }).attendant_overage_cents_per_hour as number)
            : null;
        const eventHours = (() => {
          if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return 0;
          const [ah, am] = startTime.split(":").map(Number);
          const [bh, bm] = endTime.split(":").map(Number);
          const minutes = bh * 60 + bm - (ah * 60 + am);
          return minutes > 0 ? minutes / 60 : 0;
        })();
        const { computeAttendantOverage } = await import(
          "../capabilities/service/onsite-attendant.ts"
        );
        const overage = computeAttendantOverage({
          rentalHours: eventHours,
          includedHours,
          overageRateCentsPerHour: overageRateCents,
        });
        if (overage.overageHours > 0 && overage.overageCents > 0) {
          subtotal = Number(
            (subtotal + overage.overageCents / 100).toFixed(2),
          );
          // Two decimals to match the numeric(5,2) constraint on
          // order_items.attendant_overage_hours without surprising
          // the DB with a fractional that fails to coerce.
          attendantOverageHours = Number(overage.overageHours.toFixed(2));
        }
      }

      // Phase 2e.10 — composition.add-ons dispatch. Looks up the
      // join rows scoped to the parent productId, joins the addon
      // products (name + base_price), validates customer selections
      // (max qty + product-scope) and rolls each into both subtotal
      // and the resolvedAddonLines array for the child-row insert
      // below. First cut bills each add-on as qty × addon.base_price
      // (the flat-day path); add-on per-hour billing is a follow-up.
      if (
        productCapabilitySlugs.includes("composition.add-ons") &&
        requestedAddons.length > 0
      ) {
        const { data: joinRows } = await supabase
          .from("product_addons")
          .select(
            "addon_product_id, max_quantity, addon:products!addon_product_id(id, name, base_price)",
          )
          .eq("parent_product_id", productId);
        const byAddonId = new Map<
          string,
          { name: string; basePriceCents: number; maxQuantity: number | null }
        >();
        for (const row of (joinRows ?? []) as unknown as Array<{
          addon_product_id: string;
          max_quantity: number | null;
          addon:
            | { id: string; name: string | null; base_price: number | null }
            | { id: string; name: string | null; base_price: number | null }[]
            | null;
        }>) {
          // PostgREST returns nested joins as either a single object
          // or an array depending on the FK cardinality; normalise.
          const addon = Array.isArray(row.addon) ? row.addon[0] : row.addon;
          if (!addon) continue;
          byAddonId.set(row.addon_product_id, {
            name: addon.name ?? "Add-on",
            basePriceCents:
              typeof addon.base_price === "number"
                ? Math.round(addon.base_price * 100)
                : 0,
            maxQuantity: row.max_quantity,
          });
        }
        let addonsTotalCents = 0;
        for (const sel of requestedAddons) {
          const meta = byAddonId.get(sel.addonProductId);
          if (!meta || meta.basePriceCents <= 0) continue;
          const qty =
            meta.maxQuantity != null
              ? Math.min(sel.quantity, meta.maxQuantity)
              : sel.quantity;
          if (qty <= 0) continue;
          const lineCents = qty * meta.basePriceCents;
          addonsTotalCents += lineCents;
          resolvedAddonLines.push({
            addonProductId: sel.addonProductId,
            name: meta.name,
            basePriceCents: meta.basePriceCents,
            quantity: qty,
            lineTotalCents: lineCents,
          });
        }
        if (addonsTotalCents > 0) {
          subtotal = Number(
            (subtotal + addonsTotalCents / 100).toFixed(2),
          );
        }
      }
    }
  }

  // Phase 2e.12 — variant resolution. Performed after the pricing
  // dispatch so the cents delta lands on the post-pricing subtotal
  // (a per-hour rental + variant correctly bills hours × rate + delta).
  // Scoped to the resolved productId so a crafted variant id from
  // another product / another org can't sneak through.
  if (productId && requestedVariantId) {
    // product_variants has no deleted_at column (variants are hard-
    // deleted from the form); the product_id scope is the security
    // gate that keeps a foreign variant id from being applied.
    const { data: variant } = await supabase
      .from("product_variants")
      .select("id, price_delta_cents")
      .eq("id", requestedVariantId)
      .eq("product_id", productId)
      .maybeSingle();
    if (variant && typeof variant.price_delta_cents === "number") {
      resolvedVariantId = variant.id;
      variantPriceDeltaCents = variant.price_delta_cents;
      if (variantPriceDeltaCents !== 0) {
        subtotal = Number(
          (subtotal + variantPriceDeltaCents / 100).toFixed(2),
        );
      }
    }
  }

  // Sprint 6.0 — apply the wet upcharge after the day/flat pricing
  // branch. The upcharge is a flat per-booking cleanup amortization
  // (industry pattern, not per-day), so it gets added once to
  // subtotal, never multiplied by rentalDays. Defensive: the helper
  // ignores the upcharge if the product doesn't actually support
  // wet, so a crafted ?mode=wet on a dry-only product can't bill the
  // customer extra.
  const effectiveMode: "dry" | "wet" | null =
    requestedMode && productSupportsModes.includes(requestedMode)
      ? requestedMode
      : null;
  // Captured here so the review-screen summary can show it as its own
  // line item rather than baking it into a higher subtotal that
  // surprises the customer. Zero when wet isn't applicable.
  const wetUpchargeApplied =
    effectiveMode === "wet" && (productWetUpchargeCents ?? 0) > 0
      ? (productWetUpchargeCents ?? 0) / 100
      : 0;
  if (wetUpchargeApplied > 0) {
    subtotal += wetUpchargeApplied;
  }

  // PR-2c — damage waiver opt-in surcharge. Computed off the rental
  // subtotal (excludes delivery fee + tax). The customer's accept
  // checkbox arrives as form field `damage_waiver` ("on" when ticked).
  const waiver = computeDamageWaiver({
    rentalSubtotal: subtotal,
    rateBps: productDamageWaiverBps,
    accepted: waiverAccepted,
  });
  if (waiver.amount > 0) {
    subtotal = Number((subtotal + waiver.amount).toFixed(2));
  }

  return {
    ok: true,
    subtotal,
    productId,
    productName,
    itemRentalDays,
    itemRatePerDay,
    billedHoursForLineItem,
    billedUnitsForLineItem,
    attendantOverageHours,
    resolvedVariantId,
    variantPriceDeltaCents,
    resolvedAddonLines,
    effectiveMode,
    wetUpchargeApplied,
    waiver,
    productSupportsModes,
    productWetUpchargeCents,
    productVerticalSlug,
    productDamageWaiverBps,
    orderMinimumCapabilityActive,
    productMinimumOrderCents,
    productMinimumOrderQuantity,
  };
}

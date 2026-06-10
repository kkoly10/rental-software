"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import {
  createProductSchema,
  updateProductSchema,
} from "@/lib/validation/products";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { checkPlanLimit } from "@/lib/stripe/gate";
import { BOOKABLE_ASSET_STATUSES } from "@/lib/assets/operational-status";
// Sprint 6.0 — orphan-clear rule (Q2 in the design doc) lives in the
// pricing helper so it can be unit-tested without this file's
// Supabase + auth module graph. Re-exposed locally under its old name
// to keep the existing call sites tidy.
import { reconcileWetUpchargeCents as reconcileWetUpcharge } from "@/lib/pricing/inflatable-mode";
import { validateCapabilitySlugs } from "@/lib/capabilities/registry";

/**
 * Phase 2e.1 — read the capability_slugs[] form group and filter
 * down to slugs registered in the capability registry. Unknown slugs
 * are dropped silently rather than erroring, so a save on an older
 * product that pre-dates a removed capability doesn't crash.
 *
 * The Zod schema's `capabilitySlugs` is already an array of strings
 * with length bounds. This pass adds the runtime "is it registered?"
 * filter that the schema layer can't do without circular imports.
 */
function readCapabilitySlugs(formData: FormData): string[] {
  const raw = formData
    .getAll("capability_slugs")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);

  if (raw.length === 0) return [];

  const validation = validateCapabilitySlugs(raw);
  if (validation.ok) return raw;
  const unknown = new Set(validation.unknownSlugs);
  return raw.filter((s) => !unknown.has(s));
}

/**
 * Phase 2e.3 — per-hour pricing fields. Reads the dollar inputs
 * from the form, returning numbers or undefined. The Zod schema
 * applies the cents conversion + bounds; we just convert empty
 * strings to undefined so the schema's `.optional()` kicks in.
 */
function readPerHourFields(formData: FormData) {
  const hourlyRateRaw = String(formData.get("hourly_rate") ?? "").trim();
  const minimumHoursRaw = String(formData.get("minimum_hours") ?? "").trim();
  const idleHourRateRaw = String(formData.get("idle_hour_rate") ?? "").trim();
  return {
    hourlyRate: hourlyRateRaw === "" ? undefined : hourlyRateRaw,
    minimumHours: minimumHoursRaw === "" ? undefined : Number(minimumHoursRaw),
    idleHourRate: idleHourRateRaw === "" ? undefined : idleHourRateRaw,
  };
}

/**
 * Phase 2e.3 — convert the dollar-denominated per-hour inputs into
 * the cents columns the DB expects. Null when the operator left the
 * field blank OR when the product doesn't carry pricing.per-hour
 * (forward-compat: a future capability flip shouldn't ghost-bill).
 */
function reconcilePerHourCents(
  capabilitySlugs: readonly string[],
  hourlyRate: number | undefined,
  minimumHours: number | undefined,
  idleHourRate: number | undefined,
) {
  if (!capabilitySlugs.includes("pricing.per-hour")) {
    return {
      hourly_rate_cents: null,
      minimum_hours: null,
      idle_hour_rate_cents: null,
    };
  }
  return {
    hourly_rate_cents:
      hourlyRate === undefined ? null : Math.round(hourlyRate * 100),
    minimum_hours: minimumHours ?? null,
    idle_hour_rate_cents:
      idleHourRate === undefined ? null : Math.round(idleHourRate * 100),
  };
}

/**
 * Phase 2e.4 — per-unit pricing reads + reconciliation. Same shape
 * as per-hour: when pricing.per-unit isn't selected, both DB
 * columns null out so an inactive capability never ghost-bills.
 */
function readPerUnitFields(formData: FormData) {
  const unitPriceRaw = String(formData.get("unit_price") ?? "").trim();
  const unitLabelRaw = String(formData.get("unit_label") ?? "").trim();
  return {
    unitPrice: unitPriceRaw === "" ? undefined : unitPriceRaw,
    unitLabel: unitLabelRaw === "" ? undefined : unitLabelRaw,
  };
}

function reconcilePerUnitCents(
  capabilitySlugs: readonly string[],
  unitPrice: number | undefined,
  unitLabel: string | undefined,
) {
  if (!capabilitySlugs.includes("pricing.per-unit")) {
    return { unit_price_cents: null, unit_label: null };
  }
  return {
    unit_price_cents:
      unitPrice === undefined ? null : Math.round(unitPrice * 100),
    unit_label: unitLabel ?? null,
  };
}

/**
 * Phase 2e.5 — read + reconcile for the four simpler capability
 * field sets. Each reads an int/text input, the reconcile gates on
 * the matching capability_slug, and the cents conversion happens
 * for the attendant overage rate.
 */
function readSetupWindowFields(formData: FormData) {
  const raw = String(formData.get("setup_minutes_before") ?? "").trim();
  const breakdownRaw = String(formData.get("breakdown_minutes_after") ?? "").trim();
  return {
    setupMinutesBefore: raw === "" ? undefined : Number(raw),
    breakdownMinutesAfter: breakdownRaw === "" ? undefined : Number(breakdownRaw),
  };
}

function readOnsiteAttendantFields(formData: FormData) {
  const includedRaw = String(formData.get("attendant_included_hours") ?? "").trim();
  const overageRaw = String(formData.get("attendant_overage_rate") ?? "").trim();
  return {
    attendantIncludedHours: includedRaw === "" ? undefined : Number(includedRaw),
    attendantOverageRate: overageRaw === "" ? undefined : overageRaw,
  };
}

function readCapacityFields(formData: FormData) {
  const metricRaw = String(formData.get("capacity_metric") ?? "").trim();
  const valueRaw = String(formData.get("capacity_value") ?? "").trim();
  const knownMetrics = ["guests", "sq_ft", "dancers", "servings"];
  return {
    capacityMetric: knownMetrics.includes(metricRaw)
      ? (metricRaw as "guests" | "sq_ft" | "dancers" | "servings")
      : undefined,
    capacityValue: valueRaw === "" ? undefined : Number(valueRaw),
  };
}

function readOrderMinimumFields(formData: FormData) {
  const raw = String(formData.get("minimum_order_quantity") ?? "").trim();
  return {
    minimumOrderQuantity: raw === "" ? undefined : Number(raw),
  };
}

function reconcileSetupWindow(
  capabilitySlugs: readonly string[],
  setupMinutesBefore: number | undefined,
  breakdownMinutesAfter: number | undefined,
) {
  // The setup.setup-window capability gates the pull-sheet arrival
  // display. Breakdown minutes feed the availability buffer
  // independently (a product without setup display may still need
  // to block crew time after the event). Both columns persist when
  // the capability is enabled; only setup_minutes_before is forced
  // to null when the capability is disabled.
  if (!capabilitySlugs.includes("setup.setup-window")) {
    return {
      setup_minutes_before: null,
      breakdown_minutes_after: breakdownMinutesAfter ?? null,
    };
  }
  return {
    setup_minutes_before: setupMinutesBefore ?? null,
    breakdown_minutes_after: breakdownMinutesAfter ?? null,
  };
}

function reconcileOnsiteAttendant(
  capabilitySlugs: readonly string[],
  attendantIncludedHours: number | undefined,
  attendantOverageRate: number | undefined,
) {
  if (!capabilitySlugs.includes("service.onsite-attendant")) {
    return {
      attendant_included_hours: null,
      attendant_overage_cents_per_hour: null,
    };
  }
  return {
    attendant_included_hours: attendantIncludedHours ?? null,
    attendant_overage_cents_per_hour:
      attendantOverageRate === undefined
        ? null
        : Math.round(attendantOverageRate * 100),
  };
}

function reconcileCapacity(
  capabilitySlugs: readonly string[],
  capacityMetric: "guests" | "sq_ft" | "dancers" | "servings" | undefined,
  capacityValue: number | undefined,
) {
  if (!capabilitySlugs.includes("display.capacity-calculator")) {
    return { capacity_metric: null, capacity_value: null };
  }
  return {
    capacity_metric: capacityMetric ?? null,
    capacity_value: capacityValue ?? null,
  };
}

function reconcileOrderMinimum(
  capabilitySlugs: readonly string[],
  minimumOrderQuantity: number | undefined,
) {
  if (!capabilitySlugs.includes("order.minimum-order")) {
    return { minimum_order_quantity: null };
  }
  return { minimum_order_quantity: minimumOrderQuantity ?? null };
}

export type ProductActionState = {
  ok: boolean;
  message: string;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Sprint 6.0 — pull the inflatable-vertical fields out of the form
// post in one place so create + update share the same parsing logic.
// FormData.getAll for the checkbox groups (supports_modes[],
// anchoring_methods[]); single getters for the two numeric inputs.
// The wet_upcharge orphan rule (Q2 answer in the design doc) is
// applied server-side: if `wet` is not in supports_modes, the
// upcharge is dropped to null regardless of what the form posted.
function readInflatableSetupFields(formData: FormData) {
  const supportsModes = formData
    .getAll("supports_modes")
    .map((v) => String(v))
    .filter((v) => v === "dry" || v === "wet");
  const anchoringMethods = formData
    .getAll("anchoring_methods")
    .map((v) => String(v))
    .filter((v) =>
      ["stakes", "sandbags", "water_barrels", "concrete_weights", "tie_downs"].includes(v),
    );
  const wetUpchargeRaw = String(formData.get("wet_upcharge") ?? "").trim();
  const anchorCountRaw = String(formData.get("required_anchor_count") ?? "").trim();
  return {
    // The schema's default(["dry"]) kicks in when the array is empty.
    supportsModes: supportsModes.length > 0 ? supportsModes : undefined,
    anchoringMethods,
    wetUpcharge: wetUpchargeRaw === "" ? undefined : wetUpchargeRaw,
    requiredAnchorCount: anchorCountRaw === "" ? undefined : Number(anchorCountRaw),
  };
}


export async function createProduct(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const parsed = createProductSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    categoryId: String(formData.get("category_id") ?? ""),
    basePrice: String(formData.get("base_price") ?? "0"),
    securityDeposit: String(formData.get("security_deposit") ?? "0"),
    shortDescription: String(formData.get("short_description") ?? ""),
    description: String(formData.get("description") ?? ""),
    requiresDelivery: formData.get("requires_delivery") === "on",
    isActive: formData.get("is_active") !== null,
    visibility: String(formData.get("visibility") ?? "public"),
    ...readInflatableSetupFields(formData),
    capabilitySlugs: readCapabilitySlugs(formData),
    ...readPerHourFields(formData),
    ...readPerUnitFields(formData),
    ...readSetupWindowFields(formData),
    ...readOnsiteAttendantFields(formData),
    ...readCapacityFields(formData),
    ...readOrderMinimumFields(formData),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Please review the product details.",
    };
  }

  const {
    name,
    categoryId,
    basePrice,
    securityDeposit,
    shortDescription,
    description,
    requiresDelivery,
    isActive,
    visibility,
    supportsModes,
    wetUpcharge,
    anchoringMethods,
    requiredAnchorCount,
    capabilitySlugs,
    hourlyRate,
    minimumHours,
    idleHourRate,
    unitPrice,
    unitLabel,
    setupMinutesBefore,
    breakdownMinutesAfter,
    attendantIncludedHours,
    attendantOverageRate,
    capacityMetric,
    capacityValue,
    minimumOrderQuantity,
  } = parsed.data;

  const perHourCents = reconcilePerHourCents(
    capabilitySlugs,
    hourlyRate,
    minimumHours,
    idleHourRate,
  );
  const perUnitCents = reconcilePerUnitCents(capabilitySlugs, unitPrice, unitLabel);
  const setupWindow = reconcileSetupWindow(capabilitySlugs, setupMinutesBefore, breakdownMinutesAfter);
  const attendant = reconcileOnsiteAttendant(
    capabilitySlugs,
    attendantIncludedHours,
    attendantOverageRate,
  );
  const capacity = reconcileCapacity(capabilitySlugs, capacityMetric, capacityValue);
  const orderMin = reconcileOrderMinimum(capabilitySlugs, minimumOrderQuantity);

  const wetUpchargeCents = reconcileWetUpcharge(supportsModes, wetUpcharge);

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: "${name}" would be created. Add Supabase env vars to save live products.`,
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return {
      ok: false,
      message:
        "You must be signed in with an organization to create products.",
    };
  }

  try {
    const clientKey = await getActionClientKey();
    const [userLimit, clientLimit] = await Promise.all([
      enforceRateLimit({
        scope: "products:create:user",
        actor: ctx.userId,
        limit: 25,
        windowSeconds: 300,
      }),
      enforceRateLimit({
        scope: "products:create:client",
        actor: clientKey,
        limit: 40,
        windowSeconds: 300,
      }),
    ]);

    if (!userLimit.allowed || !clientLimit.allowed) {
      return {
        ok: false,
        message:
          "Too many product creation attempts. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to create products right now. Please try again shortly.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(membership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to create products." };
  }

  const { count: productCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);

  const gate = await checkPlanLimit("products", productCount ?? 0);
  if (!gate.allowed) {
    return { ok: false, message: gate.reason ?? "Product limit reached." };
  }

  // Validate that the supplied categoryId belongs to this organization
  if (categoryId) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!cat) {
      return { ok: false, message: "Invalid category." };
    }
  }

  const slug = slugify(name);

  const { data: inserted, error } = await supabase.from("products").insert({
    organization_id: ctx.organizationId,
    category_id: categoryId ?? null,
    name,
    slug,
    short_description: shortDescription ?? null,
    description: description ?? null,
    base_price: basePrice,
    security_deposit_amount: securityDeposit,
    requires_delivery: requiresDelivery,
    is_active: isActive,
    visibility,
    pricing_model: "flat_day",
    rental_mode: "catalog_only",
    supports_modes: supportsModes,
    wet_upcharge_cents: wetUpchargeCents,
    anchoring_methods: anchoringMethods,
    required_anchor_count: requiredAnchorCount ?? null,
    capability_slugs: capabilitySlugs,
    hourly_rate_cents: perHourCents.hourly_rate_cents,
    minimum_hours: perHourCents.minimum_hours,
    idle_hour_rate_cents: perHourCents.idle_hour_rate_cents,
    unit_price_cents: perUnitCents.unit_price_cents,
    unit_label: perUnitCents.unit_label,
    setup_minutes_before: setupWindow.setup_minutes_before,
    breakdown_minutes_after: setupWindow.breakdown_minutes_after,
    attendant_included_hours: attendant.attendant_included_hours,
    attendant_overage_cents_per_hour: attendant.attendant_overage_cents_per_hour,
    capacity_metric: capacity.capacity_metric,
    capacity_value: capacity.capacity_value,
    minimum_order_quantity: orderMin.minimum_order_quantity,
  }).select("id").single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: `A product with the slug "${slug}" already exists.`,
      };
    }
    return { ok: false, message: error.message };
  }

  // Auto-create the first asset so the product is immediately bookable.
  // Asset-based model: products with zero assets cannot be reserved, so
  // a swallowed insert error here leaves the operator with a product
  // that silently rejects every checkout. Log it so we can chase root
  // causes (RLS, schema drift) and tag the redirect so the product page
  // can surface a banner asking the operator to add an asset manually.
  let assetCreated = false;
  if (isActive && inserted?.id) {
    const { error: assetError } = await supabase.from("assets").insert({
      organization_id: ctx.organizationId,
      product_id: inserted.id,
      asset_tag: `${slug}-${inserted.id.slice(-6)}-1`,
      operational_status: "ready",
      condition_status: "good",
    });
    if (assetError) {
      const { logAppError } = await import("@/lib/observability/server");
      await logAppError({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        source: "products.create",
        message: "Auto-asset creation failed after product insert",
        context: {
          productId: inserted.id,
          slug,
          assetError: assetError.message,
          assetErrorCode: assetError.code ?? null,
        },
      });
    } else {
      assetCreated = true;
    }
  }

  try {
    const { markSetupStep } = await import("@/lib/guidance/update-setup-progress");
    await markSetupStep(ctx.organizationId, "has_products");
  } catch { /* non-critical */ }

  revalidatePath("/inventory");
  revalidatePath("/dashboard/products");
  // assetCreated=0 means the auto-asset insert failed; the product page
  // reads it to render a "this product has no assets and can't be
  // booked — add one" warning.
  const flag = isActive && !assetCreated ? "&asset_pending=1" : "";
  redirect(`/dashboard/products/${inserted.id}?created=1${flag}`);
}

export async function updateProduct(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const parsed = updateProductSchema.safeParse({
    productId: String(formData.get("product_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    categoryId: String(formData.get("category_id") ?? ""),
    basePrice: String(formData.get("base_price") ?? "0"),
    securityDeposit: String(formData.get("security_deposit") ?? "0"),
    shortDescription: String(formData.get("short_description") ?? ""),
    description: String(formData.get("description") ?? ""),
    requiresDelivery: formData.get("requires_delivery") === "on",
    isActive: formData.get("is_active") !== null,
    visibility: String(formData.get("visibility") ?? "public"),
    ...readInflatableSetupFields(formData),
    capabilitySlugs: readCapabilitySlugs(formData),
    ...readPerHourFields(formData),
    ...readPerUnitFields(formData),
    ...readSetupWindowFields(formData),
    ...readOnsiteAttendantFields(formData),
    ...readCapacityFields(formData),
    ...readOrderMinimumFields(formData),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Please review the product details.",
    };
  }

  const updatePerHourCents = reconcilePerHourCents(
    parsed.data.capabilitySlugs,
    parsed.data.hourlyRate,
    parsed.data.minimumHours,
    parsed.data.idleHourRate,
  );
  const updatePerUnitCents = reconcilePerUnitCents(
    parsed.data.capabilitySlugs,
    parsed.data.unitPrice,
    parsed.data.unitLabel,
  );
  const updateSetupWindow = reconcileSetupWindow(
    parsed.data.capabilitySlugs,
    parsed.data.setupMinutesBefore,
    parsed.data.breakdownMinutesAfter,
  );
  const updateAttendant = reconcileOnsiteAttendant(
    parsed.data.capabilitySlugs,
    parsed.data.attendantIncludedHours,
    parsed.data.attendantOverageRate,
  );
  const updateCapacity = reconcileCapacity(
    parsed.data.capabilitySlugs,
    parsed.data.capacityMetric,
    parsed.data.capacityValue,
  );
  const updateOrderMin = reconcileOrderMinimum(
    parsed.data.capabilitySlugs,
    parsed.data.minimumOrderQuantity,
  );

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: "${parsed.data.name}" would be updated.`,
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return {
      ok: false,
      message:
        "You must be signed in with an organization to update products.",
    };
  }

  try {
    const userLimit = await enforceRateLimit({
      scope: "products:update:user",
      actor: ctx.userId,
      limit: 40,
      windowSeconds: 300,
    });

    if (!userLimit.allowed) {
      return {
        ok: false,
        message: "Too many product update attempts. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to update products right now. Please try again shortly.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: updateMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(updateMembership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to update products." };
  }

  // Validate that the supplied categoryId belongs to this organization
  if (parsed.data.categoryId) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("id", parsed.data.categoryId)
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!cat) {
      return { ok: false, message: "Invalid category." };
    }
  }

  const updateWetUpchargeCents = reconcileWetUpcharge(
    parsed.data.supportsModes,
    parsed.data.wetUpcharge,
  );

  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      // slug is intentionally not updated — preserves existing bookmarks and SEO URLs
      category_id: parsed.data.categoryId ?? null,
      short_description: parsed.data.shortDescription ?? null,
      description: parsed.data.description ?? null,
      base_price: parsed.data.basePrice,
      security_deposit_amount: parsed.data.securityDeposit,
      requires_delivery: parsed.data.requiresDelivery,
      is_active: parsed.data.isActive,
      visibility: parsed.data.visibility,
      supports_modes: parsed.data.supportsModes,
      wet_upcharge_cents: updateWetUpchargeCents,
      anchoring_methods: parsed.data.anchoringMethods,
      required_anchor_count: parsed.data.requiredAnchorCount ?? null,
      capability_slugs: parsed.data.capabilitySlugs,
      hourly_rate_cents: updatePerHourCents.hourly_rate_cents,
      minimum_hours: updatePerHourCents.minimum_hours,
      idle_hour_rate_cents: updatePerHourCents.idle_hour_rate_cents,
      unit_price_cents: updatePerUnitCents.unit_price_cents,
      unit_label: updatePerUnitCents.unit_label,
      setup_minutes_before: updateSetupWindow.setup_minutes_before,
      breakdown_minutes_after: updateSetupWindow.breakdown_minutes_after,
      attendant_included_hours: updateAttendant.attendant_included_hours,
      attendant_overage_cents_per_hour:
        updateAttendant.attendant_overage_cents_per_hour,
      capacity_metric: updateCapacity.capacity_metric,
      capacity_value: updateCapacity.capacity_value,
      minimum_order_quantity: updateOrderMin.minimum_order_quantity,
    })
    .eq("id", parsed.data.productId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "A product with that name already exists. Please choose a different name." };
    }
    console.error("[products] update failed:", error.message);
    return { ok: false, message: "Couldn't update the product. Please try again." };
  }

  // If the product is being activated, ensure it has at least one bookable asset.
  if (parsed.data.isActive) {
    try {
      const { count: assetCount } = await supabase
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .eq("product_id", parsed.data.productId)
        .in("operational_status", BOOKABLE_ASSET_STATUSES as unknown as string[])
        .is("deleted_at", null);

      if ((assetCount ?? 0) === 0) {
        const { data: product } = await supabase
          .from("products")
          .select("slug")
          .eq("id", parsed.data.productId)
          .eq("organization_id", ctx.organizationId)
          .is("deleted_at", null)
          .maybeSingle();

        await supabase.from("assets").insert({
          organization_id: ctx.organizationId,
          product_id: parsed.data.productId,
          asset_tag: `${product?.slug ?? parsed.data.productId}-${parsed.data.productId.slice(-6)}-1`,
          operational_status: "ready",
          condition_status: "good",
        });
      }
    } catch { /* non-critical */ }
  }

  // #362 — pricing/visibility/description all need to refresh on operator
  // list + detail and storefront catalog + detail; the previous code only
  // hit /inventory.
  revalidatePath("/inventory");
  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${parsed.data.productId}`);
  {
    const { data: product } = await supabase
      .from("products")
      .select("slug")
      .eq("id", parsed.data.productId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (product?.slug) revalidatePath(`/inventory/${product.slug}`);
  }
  redirect(`/dashboard/products/${parsed.data.productId}`);
}

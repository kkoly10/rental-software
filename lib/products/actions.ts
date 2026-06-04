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
  } = parsed.data;

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
  // Asset-based model: products with zero assets cannot be reserved.
  if (isActive && inserted?.id) {
    try {
      await supabase.from("assets").insert({
        organization_id: ctx.organizationId,
        product_id: inserted.id,
        asset_tag: `${slug}-${inserted.id.slice(-6)}-1`,
        operational_status: "ready",
        condition_status: "good",
      });
    } catch { /* non-critical — product is created; operator can manage assets manually */ }
  }

  try {
    const { markSetupStep } = await import("@/lib/guidance/update-setup-progress");
    await markSetupStep(ctx.organizationId, "has_products");
  } catch { /* non-critical */ }

  revalidatePath("/inventory");
  revalidatePath("/dashboard/products");
  redirect(`/dashboard/products/${inserted.id}?created=1`);
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
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Please review the product details.",
    };
  }

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

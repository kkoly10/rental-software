"use server";

import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import {
  createProductSchema,
  updateProductSchema,
} from "@/lib/validation/products";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";

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
  } = parsed.data;

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

  // Track setup progress (non-blocking)
  import("@/lib/guidance/update-setup-progress").then(({ markSetupStep }) =>
    markSetupStep(ctx.organizationId, "has_products")
  ).catch(() => {});

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

  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
      category_id: parsed.data.categoryId ?? null,
      short_description: parsed.data.shortDescription ?? null,
      description: parsed.data.description ?? null,
      base_price: parsed.data.basePrice,
      security_deposit_amount: parsed.data.securityDeposit,
      requires_delivery: parsed.data.requiresDelivery,
      is_active: parsed.data.isActive,
      visibility: parsed.data.visibility,
    })
    .eq("id", parsed.data.productId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, message: error.message };
  }

  redirect("/dashboard/products");
}
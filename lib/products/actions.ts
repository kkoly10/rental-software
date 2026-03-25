"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { redirect } from "next/navigation";

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
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "").trim();
  const basePrice = parseFloat(String(formData.get("base_price") ?? "0"));
  const securityDeposit = parseFloat(String(formData.get("security_deposit") ?? "0"));
  const shortDescription = String(formData.get("short_description") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const requiresDelivery = formData.get("requires_delivery") === "on";
  const isActive = formData.get("is_active") !== "off";

  if (!name) {
    return { ok: false, message: "Product name is required." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo mode: "${name}" would be created. Add Supabase env vars to save live products.` };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in with an organization to create products." };
  }

  const supabase = await createSupabaseServerClient();
  const slug = slugify(name);

  const { error } = await supabase.from("products").insert({
    organization_id: ctx.organizationId,
    category_id: categoryId || null,
    name,
    slug,
    short_description: shortDescription || null,
    description: description || null,
    base_price: basePrice,
    security_deposit_amount: securityDeposit,
    requires_delivery: requiresDelivery,
    is_active: isActive,
    visibility: "public",
    pricing_model: "flat_day",
    rental_mode: "catalog_only",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: `A product with the slug "${slug}" already exists.` };
    }
    return { ok: false, message: error.message };
  }

  redirect("/dashboard/products");
}

export async function updateProduct(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "").trim();
  const basePrice = parseFloat(String(formData.get("base_price") ?? "0"));
  const securityDeposit = parseFloat(String(formData.get("security_deposit") ?? "0"));
  const shortDescription = String(formData.get("short_description") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const requiresDelivery = formData.get("requires_delivery") === "on";
  const isActive = formData.get("is_active") !== "off";
  const visibility = String(formData.get("visibility") ?? "public").trim();

  if (!productId || !name) {
    return { ok: false, message: "Product ID and name are required." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo mode: "${name}" would be updated.` };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in with an organization to update products." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("products")
    .update({
      name,
      slug: slugify(name),
      category_id: categoryId || null,
      short_description: shortDescription || null,
      description: description || null,
      base_price: basePrice,
      security_deposit_amount: securityDeposit,
      requires_delivery: requiresDelivery,
      is_active: isActive,
      visibility,
    })
    .eq("id", productId)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  redirect("/dashboard/products");
}

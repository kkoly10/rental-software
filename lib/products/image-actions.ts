"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type ProductImageActionState = {
  ok: boolean;
  message: string;
};

const defaultState: ProductImageActionState = {
  ok: false,
  message: "",
};

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
}

function getBucketName() {
  return process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";
}

export async function uploadProductImage(
  _prevState: ProductImageActionState = defaultState,
  formData: FormData
): Promise<ProductImageActionState> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const altText = String(formData.get("alt_text") ?? "").trim();
  const file = formData.get("image_file");

  if (!productId) {
    return { ok: false, message: "Product ID is required for image upload." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image before uploading." };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: image \"${file.name}\" would be uploaded for this product.`,
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in with an organization to upload images." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (productError || !product) {
    return { ok: false, message: "Product not found for this organization." };
  }

  const { data: existingImages } = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  const bucket = getBucketName();
  const filePath = `${ctx.organizationId}/${productId}/${Date.now()}-${sanitizeFilename(file.name)}`;

  const { error: storageError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (storageError) {
    return {
      ok: false,
      message: `${storageError.message} Make sure the ${bucket} bucket and storage policies are configured.`,
    };
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

  const isPrimary = !existingImages || existingImages.length === 0;
  const sortOrder = existingImages?.length ?? 0;

  const { error: insertError } = await supabase.from("product_images").insert({
    product_id: productId,
    image_url: publicUrlData.publicUrl,
    alt_text: altText || null,
    is_primary: isPrimary,
    sort_order: sortOrder,
  });

  if (insertError) {
    return { ok: false, message: insertError.message };
  }

  return {
    ok: true,
    message: "Image uploaded successfully. Refresh the page if the new image is not visible yet.",
  };
}

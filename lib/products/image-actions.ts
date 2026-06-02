"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { sniffImageType } from "@/lib/utils/image-signature";
import { stripImageMetadata } from "@/lib/utils/strip-image-metadata";

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
  const altText = String(formData.get("alt_text") ?? "").trim().slice(0, 500);
  const file = formData.get("image_file");

  if (!productId) {
    return { ok: false, message: "Product ID is required for image upload." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image before uploading." };
  }

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, message: "Only JPEG, PNG, WebP, or GIF images are allowed." };
  }

  if (file.size > MAX_SIZE) {
    return { ok: false, message: "Image must be under 10 MB." };
  }

  // Verify the actual file bytes, not just the (forgeable) declared type.
  const sniffedType = await sniffImageType(file);
  if (!sniffedType || !ALLOWED_TYPES.includes(sniffedType)) {
    return { ok: false, message: "File content doesn't match a supported image format." };
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

  const { data: imgMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(imgMembership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to upload product images." };
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (productError || !product) {
    return { ok: false, message: "Product not found for this organization." };
  }

  const { data: existingImages } = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", productId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const bucket = getBucketName();
  const filePath = `${ctx.organizationId}/${productId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;

  // Strip EXIF/IPTC/XMP from raster formats that carry them. GIF doesn't,
  // so it passes through unchanged.
  let uploadBody: File | Buffer = file;
  let uploadContentType = file.type || undefined;
  if (sniffedType !== "image/gif") {
    try {
      const stripped = await stripImageMetadata(file, sniffedType);
      uploadBody = stripped.buffer;
      uploadContentType = stripped.mimeType;
    } catch (err) {
      console.error("[products.image] strip failed:", err instanceof Error ? err.message : err);
      return {
        ok: false,
        message: "Couldn't process the image. Please try a different file.",
      };
    }
  }

  const { error: storageError } = await supabase.storage
    .from(bucket)
    .upload(filePath, uploadBody, {
      cacheControl: "3600",
      upsert: false,
      contentType: uploadContentType,
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
    console.error("[products.image] insert failed:", insertError.message);
    // Storage upload succeeded but the DB row failed — left alone, the
    // file orphans in the bucket forever and counts against storage
    // quota. Best-effort remove it; if cleanup itself fails, log so a
    // future sweep can pick it up but don't override the original error.
    const { error: cleanupError } = await supabase.storage.from(bucket).remove([filePath]);
    if (cleanupError) {
      const { logAppError } = await import("@/lib/observability/server");
      await logAppError({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        source: "products.image",
        message: "Orphaned image cleanup failed after insert error",
        context: { bucket, filePath, insertError: insertError.message, cleanupError: cleanupError.message },
      });
    }
    return { ok: false, message: "Couldn't save the image. Please try again." };
  }

  revalidatePath(`/dashboard/products/${productId}`);
  revalidatePath("/dashboard/products");
  // #363 storefront catalog + detail render product images too
  revalidatePath("/inventory");
  {
    const { data: prod } = await supabase
      .from("products")
      .select("slug")
      .eq("id", productId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (prod?.slug) revalidatePath(`/inventory/${prod.slug}`);
  }

  return {
    ok: true,
    message: "Image uploaded successfully.",
  };
}

"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";
import type { SettingsActionState } from "./actions";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
}

function getBucketName() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images"
  );
}

const LOGO_MAX_SIZE = 2 * 1024 * 1024; // 2MB
const HERO_MAX_SIZE = 5 * 1024 * 1024; // 5MB

const LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
];

const HERO_TYPES = ["image/png", "image/jpeg", "image/webp"];

async function uploadBrandAsset(
  file: File,
  kind: "logo" | "hero",
  maxSize: number,
  allowedTypes: string[]
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (file.size > maxSize) {
    const mb = Math.round(maxSize / 1024 / 1024);
    return { ok: false, message: `File must be under ${mb}MB.` };
  }

  if (!allowedTypes.includes(file.type)) {
    return { ok: false, message: `Unsupported file type: ${file.type}` };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();
  const bucket = getBucketName();
  const filePath = `${ctx.organizationId}/brand/${kind}-${Date.now()}-${sanitizeFilename(file.name)}`;

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

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return { ok: true, url: publicUrlData.publicUrl };
}

async function saveSetting(
  key: string,
  value: string | null
): Promise<SettingsActionState> {
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  const existing = (org?.settings as Record<string, unknown>) ?? {};

  const { error } = await supabase
    .from("organizations")
    .update({ settings: { ...existing, [key]: value } })
    .eq("id", ctx.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/website");
  revalidatePath("/");
  return { ok: true, message: "Saved successfully." };
}

export async function uploadLogoImage(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const file = formData.get("logo_file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image before uploading." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Logo would be uploaded." };
  }

  const result = await uploadBrandAsset(file, "logo", LOGO_MAX_SIZE, LOGO_TYPES);
  if (!result.ok) return { ok: false, message: result.message };

  return saveSetting("brand_logo_url", result.url);
}

export async function removeLogoImage(
  _prevState: SettingsActionState,
  _formData: FormData
): Promise<SettingsActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Logo would be removed." };
  }
  return saveSetting("brand_logo_url", null);
}

export async function uploadHeroImage(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const file = formData.get("hero_file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image before uploading." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Hero image would be uploaded." };
  }

  const result = await uploadBrandAsset(file, "hero", HERO_MAX_SIZE, HERO_TYPES);
  if (!result.ok) return { ok: false, message: result.message };

  return saveSetting("hero_image_url", result.url);
}

export async function removeHeroImage(
  _prevState: SettingsActionState,
  _formData: FormData
): Promise<SettingsActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Hero image would be removed." };
  }
  return saveSetting("hero_image_url", null);
}

export async function updateSocialLinks(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const facebook = String(formData.get("social_facebook") ?? "").trim();
  const instagram = String(formData.get("social_instagram") ?? "").trim();
  const tiktok = String(formData.get("social_tiktok") ?? "").trim();
  const googleBusiness = String(formData.get("social_google_business") ?? "").trim();

  // Basic URL validation
  for (const [label, url] of [
    ["Facebook", facebook],
    ["Instagram", instagram],
    ["TikTok", tiktok],
    ["Google Business", googleBusiness],
  ] as const) {
    if (url) {
      try {
        new URL(url);
      } catch {
        return { ok: false, message: `${label} URL is not valid.` };
      }
    }
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Social links would be updated." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  const existing = (org?.settings as Record<string, unknown>) ?? {};

  const { error } = await supabase
    .from("organizations")
    .update({
      settings: {
        ...existing,
        social_facebook: facebook || null,
        social_instagram: instagram || null,
        social_tiktok: tiktok || null,
        social_google_business: googleBusiness || null,
      },
    })
    .eq("id", ctx.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/website");
  revalidatePath("/");
  return { ok: true, message: "Social links updated." };
}

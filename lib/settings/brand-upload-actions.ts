"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";
import type { SettingsActionState } from "./actions";
import { isAbsoluteHttpUrl } from "@/lib/utils/safe-href";
import { sniffImageType } from "@/lib/utils/image-signature";
import { stripImageMetadata } from "@/lib/utils/strip-image-metadata";
import { mergeOrgSettings } from "./merge-settings";

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

// SVG is intentionally excluded: it can carry inline <script>/onload and is
// served from a public bucket and rendered via <img src>, enabling stored XSS.
const LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

const HERO_TYPES = ["image/png", "image/jpeg", "image/webp"];

async function requireBrandManager(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  profileId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin"].includes(membership?.role ?? "")) {
    return { ok: false, message: "Only owners and admins can manage brand settings." };
  }
  return { ok: true };
}

async function uploadBrandAsset(
  file: File,
  kind: "logo" | "hero",
  maxSize: number,
  allowedTypes: string[]
): Promise<
  | { ok: true; url: string; bucket: string; filePath: string }
  | { ok: false; message: string }
> {
  if (file.size > maxSize) {
    const mb = Math.round(maxSize / 1024 / 1024);
    return { ok: false, message: `File must be under ${mb}MB.` };
  }

  if (!allowedTypes.includes(file.type)) {
    return { ok: false, message: `Unsupported file type: ${file.type}` };
  }

  // Verify the actual file bytes, not just the (forgeable) declared type.
  const sniffed = await sniffImageType(file);
  if (!sniffed || !allowedTypes.includes(sniffed)) {
    return { ok: false, message: "File content doesn't match a supported image format." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

  const auth = await requireBrandManager(supabase, ctx.organizationId, ctx.userId);
  if (!auth.ok) return auth;

  // Strip EXIF/IPTC/XMP before the file lands in a public bucket. Cameras
  // and phones embed GPS coordinates, device IDs, and timestamps that should
  // not be exposed via the storefront's image URLs.
  let stripped;
  try {
    stripped = await stripImageMetadata(file, sniffed);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error
        ? `Couldn't process the image: ${err.message}`
        : "Couldn't process the image.",
    };
  }

  const bucket = getBucketName();
  const filePath = `${ctx.organizationId}/brand/${kind}-${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;

  const { error: storageError } = await supabase.storage
    .from(bucket)
    .upload(filePath, stripped.buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: stripped.mimeType,
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

  return { ok: true, url: publicUrlData.publicUrl, bucket, filePath };
}

// Best-effort delete of an orphaned brand asset when saveSetting fails
// after upload. Logs but does not surface cleanup failures — the user's
// original failure message is more actionable.
async function cleanupOrphanedBrandAsset(bucket: string, filePath: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) {
      const { logAppError } = await import("@/lib/observability/server");
      await logAppError({
        source: "settings.brand-upload",
        message: "Orphaned brand asset cleanup failed",
        context: { bucket, filePath, cleanupError: error.message },
      });
    }
  } catch (err) {
    console.error("[settings.brand-upload] cleanup threw:", err);
  }
}

async function saveSetting(
  key: string,
  value: string | null
): Promise<SettingsActionState> {
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const supabase = await createSupabaseServerClient();
  const auth = await requireBrandManager(supabase, ctx.organizationId, ctx.userId);
  if (!auth.ok) return auth;

  const merged = await mergeOrgSettings(supabase, ctx.organizationId, { [key]: value });
  if (!merged.ok) return { ok: false, message: merged.message };

  revalidatePath("/dashboard/website");
  revalidatePath("/", "layout");
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

  const saved = await saveSetting("brand_logo_url", result.url);
  if (!saved.ok) {
    // saveSetting failed — the just-uploaded file is now an orphan
    // (no settings row references it). Clean up immediately.
    await cleanupOrphanedBrandAsset(result.bucket, result.filePath);
    return saved;
  }
  return { ...saved, url: result.url };
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

  const saved = await saveSetting("hero_image_url", result.url);
  if (!saved.ok) {
    await cleanupOrphanedBrandAsset(result.bucket, result.filePath);
    return saved;
  }
  return { ...saved, url: result.url };
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
      // new URL() accepts javascript:/data: — require an absolute http(s) URL.
      if (!isAbsoluteHttpUrl(url)) {
        return { ok: false, message: `${label} URL must be a valid http(s) link.` };
      }
    }
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Social links would be updated." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const supabase = await createSupabaseServerClient();
  const auth = await requireBrandManager(supabase, ctx.organizationId, ctx.userId);
  if (!auth.ok) return auth;

  const merged = await mergeOrgSettings(supabase, ctx.organizationId, {
    social_facebook: facebook || null,
    social_instagram: instagram || null,
    social_tiktok: tiktok || null,
    social_google_business: googleBusiness || null,
  });
  if (!merged.ok) return { ok: false, message: merged.message };

  revalidatePath("/dashboard/website");
  revalidatePath("/", "layout");
  return { ok: true, message: "Social links updated." };
}

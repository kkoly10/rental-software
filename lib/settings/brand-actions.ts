"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";

export type SettingsActionState = {
  ok: boolean;
  message: string;
};

const ALLOWED_FONTS = [
  "System Default",
  "Inter",
  "Poppins",
  "Montserrat",
  "Playfair Display",
  "Roboto",
];

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function isValidUrl(value: string): boolean {
  if (!value) return true; // empty is allowed
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function updateBrandSettings(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const primaryColor = String(formData.get("brand_primary_color") ?? "").trim();
  const accentColor = String(formData.get("brand_accent_color") ?? "").trim();
  const fontFamily = String(formData.get("brand_font_family") ?? "").trim();

  // Validate
  if (primaryColor && !isValidHexColor(primaryColor)) {
    return { ok: false, message: "Primary color must be a valid hex color (e.g. #1e5dcf)." };
  }

  if (accentColor && !isValidHexColor(accentColor)) {
    return { ok: false, message: "Accent color must be a valid hex color (e.g. #20b486)." };
  }

  if (fontFamily && !ALLOWED_FONTS.includes(fontFamily)) {
    return { ok: false, message: "Selected font is not in the allowed list." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Brand settings would be updated." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

  // Read existing settings
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  const existingSettings = (org?.settings as Record<string, unknown>) ?? {};

  const { error } = await supabase
    .from("organizations")
    .update({
      settings: {
        ...existingSettings,
        brand_primary_color: primaryColor || null,
        brand_accent_color: accentColor || null,
        brand_font_family: fontFamily || null,
      },
    })
    .eq("id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/website");
  revalidatePath("/");
  return { ok: true, message: "Brand settings updated." };
}

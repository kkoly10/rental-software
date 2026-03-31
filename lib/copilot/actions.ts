import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CopilotAction = {
  type:
    | "update_hero"
    | "update_service_area_text"
    | "update_booking_message"
    | "update_faq"
    | "update_about"
    | "generate_content";
  field: string;
  value: string;
  preview: string;
};

const ALLOWED_SETTINGS_FIELDS: Record<string, string> = {
  update_hero: "hero_message",
  update_service_area_text: "service_area_text",
  update_booking_message: "booking_message",
  update_faq: "custom_faq",
  update_about: "about_text",
};

export async function executeCopilotAction(
  action: CopilotAction,
  organizationId: string
): Promise<{ ok: boolean; message: string }> {
  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: ${action.preview || "Action would be applied."}`,
    };
  }

  const settingsKey =
    action.type === "generate_content"
      ? action.field
      : ALLOWED_SETTINGS_FIELDS[action.type];

  if (!settingsKey) {
    return { ok: false, message: `Unknown action type: ${action.type}` };
  }

  // For generate_content, validate the field is one we allow
  if (
    action.type === "generate_content" &&
    !Object.values(ALLOWED_SETTINGS_FIELDS).includes(settingsKey)
  ) {
    return { ok: false, message: `Cannot update field: ${action.field}` };
  }

  const supabase = await createSupabaseServerClient();

  // Read existing settings
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();

  const existingSettings = (org?.settings as Record<string, unknown>) ?? {};

  // Parse value for FAQ (expects JSON array)
  let parsedValue: unknown = action.value;
  if (settingsKey === "custom_faq") {
    try {
      parsedValue = JSON.parse(action.value);
      if (!Array.isArray(parsedValue)) {
        return {
          ok: false,
          message: "FAQ value must be a JSON array of {question, answer} items.",
        };
      }
    } catch {
      return {
        ok: false,
        message: "Invalid FAQ JSON format.",
      };
    }
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      settings: {
        ...existingSettings,
        [settingsKey]: parsedValue || null,
      },
    })
    .eq("id", organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    message: action.preview || "Changes applied successfully.",
  };
}

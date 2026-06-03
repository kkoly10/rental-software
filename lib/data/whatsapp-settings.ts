import "server-only";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type WhatsAppSettings = {
  enabled: boolean;
  senderId: string;
};

/**
 * Sprint 4 — Settings → SMS section reads this to drive the WhatsApp
 * toggle + sender-id input. Defaults to `{ enabled: false, senderId: "" }`
 * for orgs that haven't configured it yet; the Settings form lets
 * owners/admins flip it once Twilio sender approval is in place.
 */
export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  if (!hasSupabaseEnv()) return { enabled: false, senderId: "" };
  const ctx = await getOrgContext();
  if (!ctx) return { enabled: false, senderId: "" };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select("whatsapp_enabled, whatsapp_sender_id")
    .eq("id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  const row = data as Record<string, unknown> | null;
  return {
    enabled: Boolean(row?.whatsapp_enabled),
    senderId: (row?.whatsapp_sender_id as string | null) ?? "",
  };
}

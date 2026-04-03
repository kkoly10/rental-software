import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";

/**
 * Update a single setup_progress flag in the organization settings.
 * Called from product creation, service area creation, order creation, etc.
 * Non-blocking — never throws.
 */
export async function markSetupStep(
  organizationId: string,
  flag: "has_products" | "has_service_area" | "has_brand" | "has_payment_method" | "has_first_order"
): Promise<void> {
  if (!hasSupabaseEnv()) return;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();

    const settings = (org?.settings as Record<string, unknown>) ?? {};
    const progress = (settings.setup_progress as Record<string, unknown>) ?? {};

    // Skip if already marked
    if (progress[flag] === true) return;

    await supabase
      .from("organizations")
      .update({
        settings: {
          ...settings,
          setup_progress: {
            ...progress,
            [flag]: true,
          },
        },
      })
      .eq("id", organizationId);
  } catch {
    // Non-blocking
  }
}

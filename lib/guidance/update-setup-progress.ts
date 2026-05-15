import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";

/**
 * Update a single setup_progress flag in the organization settings.
 * Called from product creation, service area creation, order creation, etc.
 * Non-blocking — never throws.
 *
 * Uses the mark_org_setup_step Postgres function for an atomic jsonb_set()
 * update to avoid the read-modify-write lost-update race that would occur
 * if two server actions set different flags simultaneously.
 */
export async function markSetupStep(
  organizationId: string,
  flag: "has_products" | "has_service_area" | "has_brand" | "has_payment_method" | "has_first_order"
): Promise<void> {
  if (!hasSupabaseEnv()) return;

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.rpc("mark_org_setup_step", {
      p_org_id: organizationId,
      p_step: flag,
    });
  } catch {
    // Non-blocking
  }
}

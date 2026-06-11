import "server-only";
import { hasSupabaseEnv } from "@/lib/env";

/**
 * Seller bookability gate (roadmap item 1, master plan §12): "no
 * listing accepts bookings until the seller can actually be paid."
 *
 * Bookable = Stripe Connect `charges_enabled && details_submitted`
 * (Stripe's post-onboarding check — details_submitted alone means the
 * form was finished, not verified). The columns are mirrored onto the
 * org by the account.updated webhook, so this stays fresh without a
 * live Stripe call — and reading at decision time means a Stripe
 * restriction auto-pauses bookability with zero extra code.
 *
 * Listings stay VISIBLE when the seller isn't ready (Sharetribe
 * pattern: keep supply/SEO, disable checkout) — callers swap the
 * booking CTA for an explanatory notice.
 */
export async function sellerBookable(organizationId: string): Promise<boolean> {
  if (!hasSupabaseEnv()) return false;
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("stripe_connect_charges_enabled, stripe_connect_details_submitted")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(
    data?.stripe_connect_charges_enabled && data?.stripe_connect_details_submitted,
  );
}

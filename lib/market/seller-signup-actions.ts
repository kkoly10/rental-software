"use server";

import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { generateSlug, isSlugAvailable } from "@/lib/auth/resolve-org";

/**
 * Marketplace-only seller signup (spec §22/§23): a LIGHTWEIGHT
 * organization — business_type 'marketplace_seller', no vertical
 * bootstrap, no category seeding, no operator onboarding. These
 * sellers pay the 15% marketplace fee (Korent operators pay 8%) and
 * get the Seller Hub; the full operator toolkit stays behind the SaaS
 * subscription. Stripe Connect onboarding (required before any
 * listing is bookable) reuses the existing billing-settings flow.
 */

export type SellerSignupState = { ok: boolean; message: string };

const schema = z.object({
  businessName: z.string().min(2, "Business or display name is required.").max(80),
});

export async function createMarketplaceSellerOrg(
  _prev: SellerSignupState,
  formData: FormData,
): Promise<SellerSignupState> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Seller signup is unavailable in this environment." };
  }

  const parsed = schema.safeParse({
    businessName: String(formData.get("business_name") ?? "").trim(),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in (or create an account) first." };
  if (!user.email_confirmed_at) {
    return { ok: false, message: "Verify your email first — check your inbox." };
  }

  const existing = await getOrgContext();
  if (existing) {
    return { ok: false, message: "You already have a seller account — open the Seller Hub." };
  }

  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "market:seller-signup",
      actor: key,
      limit: 3,
      windowSeconds: 3600,
      strict: true,
    });
    if (!limit.allowed) return { ok: false, message: "Too many attempts — try again later." };
  } catch {
    return { ok: false, message: "Try again shortly." };
  }

  // Slug: derived, then suffixed until free (bounded attempts).
  const base = generateSlug(parsed.data.businessName) || "seller";
  let slug = base;
  for (let i = 0; i < 5 && !(await isSlugAvailable(slug)); i++) {
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  if (!(await isSlugAvailable(slug))) {
    return { ok: false, message: "Couldn't find a free store URL — try a different name." };
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      name: parsed.data.businessName,
      slug,
      business_type: "marketplace_seller",
    })
    .select("id")
    .single();
  if (orgError || !org) {
    return { ok: false, message: "Couldn't create your seller account — try again." };
  }

  const { error: memberError } = await admin.from("organization_memberships").insert({
    organization_id: org.id,
    profile_id: user.id,
    role: "owner",
    status: "active",
  });
  if (memberError) {
    await admin.from("organizations").delete().eq("id", org.id);
    return { ok: false, message: "Couldn't finish setup — try again." };
  }

  // Pre-create the store page so the Seller Hub opens ready to list.
  await admin.from("market_seller_profiles").insert({
    organization_id: org.id,
    slug,
    display_name: parsed.data.businessName,
  });

  return {
    ok: true,
    message:
      "Seller account created. Next: connect payouts in Settings → Billing, then publish your first listing from the Seller Hub.",
  };
}

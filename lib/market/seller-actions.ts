"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  DEFAULT_METRO_SLUG,
  RESERVED_MARKETPLACE_SUBDOMAINS,
  getCategory,
  getWorld,
  metroBySlug,
  resolveOperatingDefaults,
} from "@/lib/market/registry";
import { computeDepositCents, type ItemCondition } from "@/lib/market/fees";

/**
 * Seller Hub v1 actions (spec §32 / build plan M1): seller profile
 * upsert, listing create/publish/pause for Korent operators selling
 * on the marketplace. Authorization = RLS (owner/admin write
 * policies) on top of an app-side role check via getOrgContext().
 *
 * Boundary note: this module references the operator's catalog by
 * PRODUCT ID only — it never imports operator order/route/checkout
 * logic (build plan Rule 1).
 */

export type SellerActionState = { ok: boolean; message: string };

const MARKET_DASHBOARD_PATH = "/dashboard/marketplace";

async function requireOrg(): Promise<
  | { ok: true; orgId: string }
  | { ok: false; state: SellerActionState }
> {
  if (!hasSupabaseEnv()) {
    return { ok: false, state: { ok: false, message: "Marketplace is unavailable in this environment." } };
  }
  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, state: { ok: false, message: "Sign in to manage your marketplace presence." } };
  }
  return { ok: true, orgId: ctx.organizationId };
}

async function rateLimited(scope: string): Promise<boolean> {
  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope,
      actor: key,
      limit: 30,
      windowSeconds: 300,
      strict: true,
    });
    return !limit.allowed;
  } catch {
    return true;
  }
}

// ── Seller profile ────────────────────────────────────────────────────

const profileSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/, "Lowercase letters, numbers and dashes only."),
  displayName: z.string().min(2, "Store name is too short.").max(80),
  bio: z.string().max(600).optional().or(z.literal("")),
  serviceRadiusMiles: z.coerce.number().int().min(1).max(200).default(15),
  stateCode: z.enum(["DC", "MD", "VA"]),
  offersDelivery: z.coerce.boolean(),
  offersPickup: z.coerce.boolean(),
});

export async function upsertSellerProfile(
  _prev: SellerActionState,
  formData: FormData,
): Promise<SellerActionState> {
  const auth = await requireOrg();
  if (!auth.ok) return auth.state;
  if (await rateLimited("market:seller-profile")) {
    return { ok: false, message: "Too many changes — try again in a few minutes." };
  }

  const parsed = profileSchema.safeParse({
    slug: String(formData.get("slug") ?? "").toLowerCase().trim(),
    displayName: formData.get("display_name"),
    bio: formData.get("bio") ?? "",
    serviceRadiusMiles: formData.get("service_radius_miles") ?? 15,
    stateCode: formData.get("state_code") ?? "DC",
    offersDelivery: formData.get("offers_delivery") === "on",
    offersPickup: formData.get("offers_pickup") === "on",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  if ((RESERVED_MARKETPLACE_SUBDOMAINS as readonly string[]).includes(parsed.data.slug)) {
    return { ok: false, message: "That store name is reserved." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("market_seller_profiles").upsert(
    {
      organization_id: auth.orgId,
      slug: parsed.data.slug,
      display_name: parsed.data.displayName,
      bio: parsed.data.bio || null,
      metro_slug: DEFAULT_METRO_SLUG,
      service_radius_miles: parsed.data.serviceRadiusMiles,
      state_code: parsed.data.stateCode,
      offers_delivery: parsed.data.offersDelivery,
      offers_pickup: parsed.data.offersPickup,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "That store URL is taken — pick another." };
    }
    return { ok: false, message: "Couldn't save your store page. Are you an owner or admin?" };
  }

  revalidatePath(MARKET_DASHBOARD_PATH);
  return { ok: true, message: "Store page saved." };
}

// ── Listings ──────────────────────────────────────────────────────────

const listingSchema = z.object({
  worldSlug: z.string().min(1),
  categorySlug: z.string().min(1),
  title: z.string().min(4, "Title is too short.").max(140),
  description: z.string().max(4000).optional().or(z.literal("")),
  condition: z.enum(["new", "excellent", "good", "fair", "worn"]),
  acquiredYear: z.coerce.number().int().min(1990).max(2100).optional(),
  replacementValue: z.coerce.number().min(0).max(500_000),
  dailyPrice: z.coerce.number().min(1, "Daily price is required.").max(100_000),
  quantity: z.coerce.number().int().min(1).max(10_000).default(1),
  offersDelivery: z.coerce.boolean(),
  offersPickup: z.coerce.boolean(),
  productId: z.string().uuid().optional().or(z.literal("")),
});

export async function createMarketListing(
  _prev: SellerActionState,
  formData: FormData,
): Promise<SellerActionState> {
  const auth = await requireOrg();
  if (!auth.ok) return auth.state;
  if (await rateLimited("market:listing-create")) {
    return { ok: false, message: "Too many changes — try again in a few minutes." };
  }

  const parsed = listingSchema.safeParse({
    worldSlug: formData.get("world_slug"),
    categorySlug: formData.get("category_slug"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    condition: formData.get("condition") ?? "good",
    acquiredYear: formData.get("acquired_year") || undefined,
    replacementValue: formData.get("replacement_value") || 0,
    dailyPrice: formData.get("daily_price"),
    quantity: formData.get("quantity") || 1,
    offersDelivery: formData.get("offers_delivery") === "on",
    offersPickup: formData.get("offers_pickup") === "on",
    productId: formData.get("product_id") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const world = getWorld(parsed.data.worldSlug);
  const category = getCategory(parsed.data.worldSlug, parsed.data.categorySlug);
  if (!world || !category) {
    return { ok: false, message: "Pick a valid world and category." };
  }

  const defaults = resolveOperatingDefaults(world.slug, category.slug);

  // Deposit from the §9 engine; cap precedence handled inside.
  const nowYear = new Date().getFullYear();
  const ageMonths = parsed.data.acquiredYear
    ? Math.max(0, (nowYear - parsed.data.acquiredYear) * 12)
    : 24;
  const replacementCents = Math.round(parsed.data.replacementValue * 100);
  const deposit =
    replacementCents > 0
      ? computeDepositCents({
          replacementValueCents: replacementCents,
          ageMonths,
          condition: parsed.data.condition as ItemCondition,
          riskFamilyPct: defaults.depositPct,
          depositFloorCents: defaults.depositFloorCents,
        }).depositCents
      : defaults.depositFloorCents;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("market_listings").insert({
    organization_id: auth.orgId,
    product_id: parsed.data.productId || null,
    world_slug: world.slug,
    category_slug: category.slug,
    risk_family_slug: category.riskFamilySlug,
    title: parsed.data.title,
    description: parsed.data.description || null,
    condition: parsed.data.condition,
    acquired_year: parsed.data.acquiredYear ?? null,
    replacement_value_cents: replacementCents || null,
    daily_price_cents: Math.round(parsed.data.dailyPrice * 100),
    deposit_cents: deposit,
    inventory_mode: parsed.data.quantity > 1 ? "quantity" : "serialized",
    quantity: parsed.data.quantity,
    prep_buffer_minutes: defaults.prepBufferMinutes,
    recovery_buffer_minutes: defaults.recoveryBufferMinutes,
    offers_delivery: parsed.data.offersDelivery && defaults.deliveryAllowed,
    offers_pickup: parsed.data.offersPickup,
    metro_slug: DEFAULT_METRO_SLUG,
    // Smoke-test worlds take pre-listings only (spec §31): they
    // publish as browsable-but-not-bookable demand signals.
    is_prelist: world.status === "smoke_test",
    status: "draft",
  });

  if (error) {
    if (error.code === "23503") {
      return { ok: false, message: "Create your store page first — listings hang off it." };
    }
    return { ok: false, message: "Couldn't create the listing. Are you an owner or admin?" };
  }

  revalidatePath(MARKET_DASHBOARD_PATH);
  return { ok: true, message: "Listing created as a draft — publish it when it's ready." };
}

async function setListingStatus(
  listingId: string,
  status: "published" | "paused",
): Promise<SellerActionState> {
  const auth = await requireOrg();
  if (!auth.ok) return auth.state;
  if (await rateLimited("market:listing-status")) {
    return { ok: false, message: "Too many changes — try again in a few minutes." };
  }
  if (!z.string().uuid().safeParse(listingId).success) {
    return { ok: false, message: "Invalid listing." };
  }

  const supabase = await createSupabaseServerClient();

  // §6 moderation gate: first-time publishes in review-required
  // categories enter pending_review for the trust queue instead of
  // going live. published_at doubles as the "approved once" marker —
  // re-publishing after a pause skips re-review.
  let effectiveStatus: string = status;
  if (status === "published") {
    const { data: listing } = await supabase
      .from("market_listings")
      .select("world_slug, category_slug, published_at")
      .eq("id", listingId)
      .eq("organization_id", auth.orgId)
      .maybeSingle();
    if (!listing) return { ok: false, message: "Couldn't update the listing." };
    try {
      const defaults = resolveOperatingDefaults(listing.world_slug, listing.category_slug);
      if (defaults.listingReviewRequired && !listing.published_at) {
        effectiveStatus = "pending_review";
      }
    } catch {
      effectiveStatus = "pending_review"; // unknown category = review it
    }
  }

  const update: Record<string, unknown> = {
    status: effectiveStatus,
    updated_at: new Date().toISOString(),
  };
  if (effectiveStatus === "published") update.published_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("market_listings")
    .update(update)
    .eq("id", listingId)
    .eq("organization_id", auth.orgId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "Couldn't update the listing." };
  }
  revalidatePath(MARKET_DASHBOARD_PATH);
  if (effectiveStatus === "pending_review") {
    return {
      ok: true,
      message: "Submitted for review — this category requires a quick trust check before going live.",
    };
  }
  return { ok: true, message: status === "published" ? "Listing published." : "Listing paused." };
}

export async function publishListing(formData: FormData): Promise<void> {
  await setListingStatus(String(formData.get("listing_id") ?? ""), "published");
}

export async function pauseListing(formData: FormData): Promise<void> {
  await setListingStatus(String(formData.get("listing_id") ?? ""), "paused");
}

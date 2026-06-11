"use server";

import { randomUUID } from "node:crypto";
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
  instantBook: z.coerce.boolean(),
  productId: z.string().uuid().optional().or(z.literal("")),
});

const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_VIDEO_SIZE = 80 * 1024 * 1024;

// #62: listing photos + proof videos are INTENTIONAL public media (the
// storefront's face) and must live in a PUBLIC bucket — `uploads` is
// private (crew proof photos), so getPublicUrl links into it 400.
// market-media has no client write policies (service-role writes only)
// and is never walked by the storage-sweep cron.
const PUBLIC_MEDIA_BUCKET = "market-media";

/** Proof-of-function video (§6, founder decision 2026-06-11): for
 *  powered/electric categories the seller shows the item working —
 *  e.g. a blow dryer running — as part of creating the listing. */
async function uploadProofVideo(
  file: File,
  orgId: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (!VIDEO_TYPES.includes(file.type)) {
    return { ok: false, message: "Proof video must be MP4, MOV or WebM." };
  }
  if (file.size > MAX_VIDEO_SIZE) {
    return { ok: false, message: "Proof video must be under 80 MB." };
  }
  // Bug #38: don't trust the client-declared type — sniff the container
  // magic bytes (ftyp box for MP4/MOV, EBML header for WebM).
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isMp4 = head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70; // 'ftyp'
  const isWebm = head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3; // EBML
  if (!isMp4 && !isWebm) {
    return { ok: false, message: "That file doesn't look like a valid video." };
  }
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  // Proof video is a trust signal rendered on the public listing page
  // (like the listing photo). A random token defeats the orgId/timestamp
  // enumeration noted in #39 and the same-millisecond upsert collision.
  const ext = file.type === "video/quicktime" ? "mov" : file.type === "video/webm" ? "webm" : "mp4";
  const path = `market-proof/${orgId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await admin.storage
    .from(PUBLIC_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, message: "Video upload failed — try again." };
  const { data } = admin.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

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
    instantBook: formData.get("instant_book") === "on",
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

  // Listing photo (the eBay-feel requirement — emoji placeholders
  // don't sell tents). Optional but strongly encouraged by the form.
  let photoUrl: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const IMG_TYPES = ["image/jpeg", "image/png", "image/webp"];
    if (!IMG_TYPES.includes(photo.type) || photo.size > 15 * 1024 * 1024) {
      return { ok: false, message: "Photo must be JPEG/PNG/WebP under 15 MB." };
    }
    const { sniffImageType } = await import("@/lib/utils/image-signature");
    const sniffed = await sniffImageType(photo);
    if (!sniffed || !IMG_TYPES.includes(sniffed)) {
      return { ok: false, message: "Photo content doesn't match a supported image format." };
    }
    const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
    const adminClient = createSupabaseAdminClient();
    const ext = sniffed === "image/png" ? "png" : sniffed === "image/webp" ? "webp" : "jpg";
    const path = `market-listings/${auth.orgId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const { error: uploadError } = await adminClient.storage
      .from(PUBLIC_MEDIA_BUCKET)
      .upload(path, photo, { contentType: sniffed, upsert: false });
    if (uploadError) return { ok: false, message: "Photo upload failed — try again." };
    photoUrl = adminClient.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // Proof-of-function: required at creation time for categories that
  // demand it; optional everywhere else.
  let proofVideoUrl: string | null = null;
  const proofVideo = formData.get("proof_video");
  if (proofVideo instanceof File && proofVideo.size > 0) {
    const uploaded = await uploadProofVideo(proofVideo, auth.orgId);
    if (!uploaded.ok) return { ok: false, message: uploaded.message };
    proofVideoUrl = uploaded.url;
  } else if (defaults.proofOfFunctionRequired) {
    return {
      ok: false,
      message: "This category needs a short proof-of-function video — show the item powered on and working.",
    };
  }

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
    instant_book: parsed.data.instantBook && defaults.instantBookAllowed,
    proof_video_url: proofVideoUrl,
    photo_url: photoUrl,
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
      .select("world_slug, category_slug, published_at, proof_video_url")
      .eq("id", listingId)
      .eq("organization_id", auth.orgId)
      .maybeSingle();
    if (!listing) return { ok: false, message: "Couldn't update the listing." };
    try {
      const defaults = resolveOperatingDefaults(listing.world_slug, listing.category_slug);
      if (defaults.proofOfFunctionRequired && !listing.proof_video_url) {
        return {
          ok: false,
          message: "Add a proof-of-function video before publishing — this category requires one.",
        };
      }
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

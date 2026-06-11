import { hasSupabaseEnv } from "@/lib/env";
import { getWorld } from "@/lib/market/registry";
import { rankListings, type SellerStats } from "@/lib/market/ranking";

/**
 * Marketplace public reads. Server-only. Reads published listings and
 * active seller profiles via the anon-scoped policies — no tenant
 * header involved (the marketplace is one site, not a tenant
 * storefront). Every function degrades to empty data when Supabase
 * env is absent so builds/previews without env stay green.
 */

export type MarketListing = {
  id: string;
  organizationId: string;
  worldSlug: string;
  categorySlug: string;
  riskFamilySlug: string;
  title: string;
  description: string | null;
  condition: string;
  dailyPriceCents: number;
  weekendPriceCents: number | null;
  weeklyPriceCents: number | null;
  depositCents: number;
  offersDelivery: boolean;
  offersPickup: boolean;
  metroSlug: string;
  photoUrl: string | null;
  isPrelist: boolean;
  status: string;
  inventoryMode: string;
  quantity: number;
  sellerSlug: string | null;
  sellerDisplayName: string | null;
};

export type MarketSellerProfile = {
  organizationId: string;
  slug: string;
  displayName: string;
  bio: string | null;
  metroSlug: string;
  serviceRadiusMiles: number;
  offersDelivery: boolean;
  offersPickup: boolean;
};

const LISTING_SELECT = `
  id, organization_id, world_slug, category_slug, risk_family_slug,
  title, description, condition, daily_price_cents, weekend_price_cents,
  weekly_price_cents, deposit_cents, offers_delivery, offers_pickup,
  metro_slug, photo_url, is_prelist, status, inventory_mode, quantity,
  market_seller_profiles ( slug, display_name )
`;

type ListingRow = {
  id: string;
  organization_id: string;
  world_slug: string;
  category_slug: string;
  risk_family_slug: string;
  title: string;
  description: string | null;
  condition: string;
  daily_price_cents: number;
  weekend_price_cents: number | null;
  weekly_price_cents: number | null;
  deposit_cents: number;
  offers_delivery: boolean;
  offers_pickup: boolean;
  metro_slug: string;
  photo_url: string | null;
  is_prelist: boolean;
  status: string;
  inventory_mode: string;
  quantity: number;
  market_seller_profiles: { slug: string; display_name: string } | null;
};

function mapListing(row: ListingRow): MarketListing {
  return {
    id: row.id,
    organizationId: row.organization_id,
    worldSlug: row.world_slug,
    categorySlug: row.category_slug,
    riskFamilySlug: row.risk_family_slug,
    title: row.title,
    description: row.description,
    condition: row.condition,
    dailyPriceCents: row.daily_price_cents,
    weekendPriceCents: row.weekend_price_cents,
    weeklyPriceCents: row.weekly_price_cents,
    depositCents: row.deposit_cents,
    offersDelivery: row.offers_delivery,
    offersPickup: row.offers_pickup,
    metroSlug: row.metro_slug,
    photoUrl: row.photo_url,
    isPrelist: row.is_prelist,
    status: row.status,
    inventoryMode: row.inventory_mode,
    quantity: row.quantity,
    sellerSlug: row.market_seller_profiles?.slug ?? null,
    sellerDisplayName: row.market_seller_profiles?.display_name ?? null,
  };
}

async function getClient() {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  return createSupabaseServerClient();
}

export async function getPublishedListings(options: {
  worldSlug?: string;
  categorySlug?: string;
  metroSlug?: string;
  query?: string;
  limit?: number;
}): Promise<MarketListing[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await getClient();

  let q = supabase
    .from("market_listings")
    .select(LISTING_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(Math.min(options.limit ?? 24, 60));

  if (options.worldSlug) q = q.eq("world_slug", options.worldSlug);
  if (options.categorySlug) q = q.eq("category_slug", options.categorySlug);
  if (options.metroSlug) q = q.eq("metro_slug", options.metroSlug);
  if (options.query) {
    const escaped = options.query.replace(/[%_,]/g, " ").trim();
    if (escaped) q = q.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
  }

  const { data, error } = await q;
  if (error || !data) return [];
  const listings = (data as unknown as ListingRow[]).map(mapListing);

  // §21 ranking: order by seller quality, never by price. Stats are
  // read with the admin client (bookings aren't anon-readable) but
  // only aggregates ever leave this function.
  if (listings.length > 1) {
    try {
      const stats = await getSellerStatsByOrg([
        ...new Set(listings.map((l) => l.organizationId)),
      ]);
      return rankListings(listings, stats);
    } catch {
      return listings; // ranking is best-effort; never break browse
    }
  }
  return listings;
}

async function getSellerStatsByOrg(
  orgIds: string[],
): Promise<Map<string, SellerStats>> {
  const stats = new Map<string, SellerStats>();
  if (orgIds.length === 0) return stats;
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const [reviewsRes, bookingsRes] = await Promise.all([
    admin.from("market_reviews").select("organization_id, rating").in("organization_id", orgIds).limit(2000),
    admin
      .from("market_bookings")
      .select("organization_id, state")
      .in("organization_id", orgIds)
      .in("state", ["completed", "disputed"])
      .limit(2000),
  ]);

  for (const id of orgIds) {
    stats.set(id, { avgRating: null, reviewCount: 0, completedBookings: 0, disputes: 0 });
  }
  const ratingSums = new Map<string, number>();
  for (const r of (reviewsRes.data ?? []) as { organization_id: string; rating: number }[]) {
    const s = stats.get(r.organization_id);
    if (!s) continue;
    s.reviewCount += 1;
    ratingSums.set(r.organization_id, (ratingSums.get(r.organization_id) ?? 0) + r.rating);
  }
  for (const [id, sum] of ratingSums) {
    const s = stats.get(id)!;
    s.avgRating = sum / s.reviewCount;
  }
  for (const b of (bookingsRes.data ?? []) as { organization_id: string; state: string }[]) {
    const s = stats.get(b.organization_id);
    if (!s) continue;
    if (b.state === "completed") s.completedBookings += 1;
    else s.disputes += 1;
  }
  return stats;
}

export async function getListingById(id: string): Promise<MarketListing | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("market_listings")
    .select(LISTING_SELECT)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;
  const listing = mapListing(data as unknown as ListingRow);
  // Defense in depth: a listing whose world no longer exists in the
  // registry should never render.
  if (!getWorld(listing.worldSlug)) return null;
  return listing;
}

export async function getSellerProfileBySlug(
  slug: string,
): Promise<MarketSellerProfile | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("market_seller_profiles")
    .select(
      "organization_id, slug, display_name, bio, metro_slug, service_radius_miles, offers_delivery, offers_pickup",
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return {
    organizationId: data.organization_id,
    slug: data.slug,
    displayName: data.display_name,
    bio: data.bio,
    metroSlug: data.metro_slug,
    serviceRadiusMiles: data.service_radius_miles,
    offersDelivery: data.offers_delivery,
    offersPickup: data.offers_pickup,
  };
}

export async function getSellerListings(
  organizationId: string,
): Promise<MarketListing[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("market_listings")
    .select(LISTING_SELECT)
    .eq("organization_id", organizationId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(48);
  if (error || !data) return [];
  return (data as unknown as ListingRow[]).map(mapListing);
}

/** Count of published listings per world for the home-page tiles. */
export async function getWorldListingCounts(
  metroSlug: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!hasSupabaseEnv()) return counts;
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("market_listings")
    .select("world_slug")
    .eq("status", "published")
    .eq("metro_slug", metroSlug)
    .limit(1000);
  if (error || !data) return counts;
  for (const row of data as { world_slug: string }[]) {
    counts.set(row.world_slug, (counts.get(row.world_slug) ?? 0) + 1);
  }
  return counts;
}

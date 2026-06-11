import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSellerListings, getSellerProfileBySlug } from "@/lib/market/data";
import { metroBySlug } from "@/lib/market/registry";
import { ListingCard } from "@/components/market/listing-card";
import { worldPhoto } from "@/lib/market/photos";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getSellerProfileBySlug(slug);
  if (!profile) return {};
  return { title: profile.displayName };
}

/**
 * Seller store PAGE (spec §22) — a profile inside the marketplace at
 * /market/store/{slug}. Not a website, no subdomain, and deliberately
 * no external links (anti-leakage, §20).
 */
export default async function StorePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const profile = await getSellerProfileBySlug(slug);
  if (!profile) notFound();

  const listings = await getSellerListings(profile.organizationId);
  const metro = metroBySlug.get(profile.metroSlug);

  // Public trust signals: verified-rental reviews (anon-readable RLS).
  const { hasSupabaseEnv } = await import("@/lib/env");
  let reviews: Array<{ id: string; rating: number; body: string | null; created_at: string }> = [];
  // Bug #34: the rating average + count must come from ALL reviews, not
  // just the 10 latest shown as cards.
  let avgRating: number | null = null;
  let reviewCount = 0;
  if (hasSupabaseEnv()) {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const [{ data: latest }, { data: all, count }] = await Promise.all([
      supabase
        .from("market_reviews")
        .select("id, rating, body, created_at")
        .eq("organization_id", profile.organizationId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("market_reviews")
        .select("rating", { count: "exact" })
        .eq("organization_id", profile.organizationId)
        .limit(5000),
    ]);
    reviews = latest ?? [];
    reviewCount = count ?? all?.length ?? 0;
    if (all && all.length > 0) {
      avgRating = all.reduce((sum, r) => sum + (r as { rating: number }).rating, 0) / all.length;
    }
  }

  const cover = listings.find((l) => l.photoUrl)?.photoUrl ?? worldPhoto("hosting-and-events");

  return (
    <main className="mk-wrap">
      <div className="mk-crumb">
        <Link href="/market">Marketplace</Link> · <b>{profile.displayName}</b>
      </div>
      <div className="mk-cover" style={cover ? { backgroundImage: `url(${cover})` } : undefined} />
      <div className="mk-store-head">
        <div className="mk-store-avatar" aria-hidden>
          {profile.displayName.trim().charAt(0).toUpperCase()}
        </div>
        <div style={{ paddingBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 26 }}>{profile.displayName}</h1>
          <span className="mk-badge v">✔ Verified seller</span>
        </div>
      </div>
      <div className="mk-stats">
        <div className="mk-stat">
          <b>{avgRating ? `★ ${avgRating.toFixed(1)}` : "New"}</b>
          <span>{reviewCount} verified review{reviewCount === 1 ? "" : "s"}</span>
        </div>
        <div className="mk-stat">
          <b>{listings.length}</b>
          <span>live listing{listings.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mk-stat">
          <b>{profile.serviceRadiusMiles} mi</b>
          <span>service radius · {metro?.label ?? "DMV"}</span>
        </div>
        <div className="mk-stat">
          <b>
            {profile.offersDelivery && profile.offersPickup
              ? "Both"
              : profile.offersDelivery
                ? "Delivery"
                : "Pickup"}
          </b>
          <span>fulfillment</span>
        </div>
      </div>
      {profile.bio ? <p className="mk-sub">{profile.bio}</p> : null}

      <h2>
        Live inventory · {listings.length} listing{listings.length === 1 ? "" : "s"}
      </h2>
      {listings.length > 0 ? (
        <div className="mk-cards">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      ) : (
        <div className="mk-panel">
          <b>No published listings yet.</b>
        </div>
      )}

      {reviews.length > 0 ? (
        <>
          <h2>Verified-rental reviews</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {reviews.map((r) => (
              <div key={r.id} className="mk-panel">
                <b>{"★".repeat(r.rating)}</b>
                {r.body ? <p className="mk-sub" style={{ margin: "6px 0 0" }}>“{r.body}”</p> : null}
                <div className="mk-card-m" style={{ marginTop: 4 }}>
                  {new Date(r.created_at).toLocaleDateString()} · verified rental
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}

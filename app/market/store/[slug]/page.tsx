import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSellerListings, getSellerProfileBySlug } from "@/lib/market/data";
import { metroBySlug } from "@/lib/market/registry";
import { ListingCard } from "@/components/market/listing-card";

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

  return (
    <main className="mk-wrap">
      <div className="mk-crumb">
        <Link href="/market">Marketplace</Link> · <b>{profile.displayName}</b>
      </div>
      <h1>{profile.displayName}</h1>
      <p className="mk-sub">
        <span className="mk-badge v">✔ Verified seller</span>{" "}
        {metro ? `· ${metro.label}` : null} · serves {profile.serviceRadiusMiles} mi
        {profile.offersDelivery && profile.offersPickup
          ? " · delivery & pickup"
          : profile.offersDelivery
            ? " · delivery"
            : " · pickup"}
      </p>
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
    </main>
  );
}

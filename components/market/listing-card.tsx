import Link from "next/link";
import type { MarketListing } from "@/lib/market/data";
import { getCategory } from "@/lib/market/registry";

function formatDollars(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

const CATEGORY_ICONS: Record<string, string> = {
  "tents-and-canopies": "⛺",
  tables: "🪑",
  "chairs-and-seating": "🪑",
  "dance-floors-and-staging": "🕺",
  "photo-booths": "📸",
  "concessions-and-food-service": "🍿",
  "audio-visual-and-presentation": "📽️",
  "games-and-entertainment": "🎯",
};

export function ListingCard({ listing }: { listing: MarketListing }) {
  const category = getCategory(listing.worldSlug, listing.categorySlug);
  const icon = CATEGORY_ICONS[listing.categorySlug] ?? "📦";
  return (
    <Link href={`/market/listing/${listing.id}`} className="mk-card">
      <div className="mk-ph">
        {listing.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photoUrl} alt={listing.title} loading="lazy" />
        ) : (
          <span aria-hidden>{icon}</span>
        )}
      </div>
      <div className="mk-card-bd">
        <div className="mk-card-t">{listing.title}</div>
        <div className="mk-card-m">
          {listing.sellerDisplayName ?? "Local seller"}
          {category ? ` · ${category.label}` : ""}
        </div>
        <div className="mk-card-m">
          {listing.isPrelist ? (
            <span className="mk-badge soon">Coming soon</span>
          ) : (
            <span className="mk-badge v">✔ Bookable</span>
          )}
        </div>
        <div className="mk-card-p">
          {formatDollars(listing.dailyPriceCents)} <small>/ day</small>
        </div>
      </div>
    </Link>
  );
}

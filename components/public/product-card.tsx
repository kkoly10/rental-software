"use client";

import Link from "next/link";
import Image from "next/image";
import { getPlaceholderImage } from "@/lib/utils/placeholders";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Editorial product card. Photo at 4:5 with hover scale, tracked
 * uppercase category, serif product name, price + status dot beneath
 * a hairline divider, single underlined text-link CTA.
 *
 * Explicit absences (per spec anti-patterns §3):
 *   • no box-shadow on the card
 *   • no pill-shaped status chip — small dot + label
 *   • no soft-orange "View Details" button — text-link
 *   • no description rendered (PDP handles longform copy)
 *
 * The `description` prop is kept for backward compatibility but
 * intentionally unused in the card body.
 */
export function ProductCard({
  name,
  slug,
  price,
  category,
  status,
  imageUrl,
  date,
  zip,
}: {
  name: string;
  slug: string;
  price: string;
  category: string;
  description: string;
  status: string;
  imageUrl?: string;
  date?: string;
  zip?: string;
}) {
  const { messages: m } = useI18n();
  const isUnavailable = status.startsWith("Unavailable");
  const isLimited = status === "Limited";
  const statusState = isUnavailable ? "unavailable" : isLimited ? "limited" : "available";

  const displayImage = imageUrl || getPlaceholderImage(category);

  // Split "$175/day" → "$175" + " / day" so the period typesets
  // smaller in muted color.
  const priceMatch = /^(.*?)(\s*\/\s*\w+.*)$/.exec(price);
  const priceAmount = priceMatch ? priceMatch[1].trim() : price;
  const pricePeriod = priceMatch ? priceMatch[2] : "";

  const detailHref =
    `/inventory/${slug}` +
    (date || zip
      ? `?${new URLSearchParams({
          ...(date ? { date } : {}),
          ...(zip ? { zip } : {}),
        }).toString()}`
      : "");

  return (
    <article className={`st-rental${isUnavailable ? " st-rental--unavailable" : ""}`}>
      <Link href={detailHref} className="st-rental-photo" aria-label={name}>
        <Image
          src={displayImage}
          alt={name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="st-rental-photo-img"
        />
      </Link>
      <div className="st-rental-body">
        <span className="st-eyebrow st-rental-cat">{category}</span>
        <Link href={detailHref} className="st-rental-name">
          {name}
        </Link>
        <div className="st-rental-meta">
          <span className="st-rental-price">
            {priceAmount}
            {pricePeriod && <small>{pricePeriod}</small>}
          </span>
          <span className="st-status" data-state={statusState}>
            {status}
          </span>
        </div>
        <Link href={detailHref} className="st-text-link st-rental-cta">
          {m.inventory.viewDetails} →
        </Link>
      </div>
    </article>
  );
}

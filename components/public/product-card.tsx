"use client";

import Link from "next/link";
import Image from "next/image";
import { getPlaceholderImage } from "@/lib/utils/placeholders";
import { useI18n } from "@/lib/i18n/provider";

export function ProductCard({
  name,
  slug,
  price,
  category,
  description,
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

  const displayImage = imageUrl || getPlaceholderImage(category);

  const statusClass = isUnavailable
    ? "is-unavailable"
    : isLimited
    ? "is-limited"
    : "is-available";

  // Split the price string into the dollar amount and the period
  // (e.g. "$175/day" → "$175" + "/day") so we can typeset the period in
  // a softer color, matching the Carnival product-card design.
  const priceParts = /^(.*?)(\s*\/\s*\w+.*)$/.exec(price);
  const priceAmount = priceParts ? priceParts[1].trim() : price;
  const pricePeriod = priceParts ? priceParts[2] : "";

  const detailHref =
    `/inventory/${slug}` +
    (date || zip
      ? `?${new URLSearchParams({
          ...(date ? { date } : {}),
          ...(zip ? { zip } : {}),
        }).toString()}`
      : "");

  return (
    <article
      className={`st-product-card${isUnavailable ? " st-product-card-unavailable" : ""}`}
    >
      <div className="st-product-media">
        <Image
          src={displayImage}
          alt={name}
          fill
          sizes="(max-width: 540px) 100vw, (max-width: 980px) 50vw, 25vw"
          className="st-product-media-img"
        />
        <span className="st-product-pill-cat">{category}</span>
        <span className={`st-product-pill-status ${statusClass}`}>{status}</span>
      </div>
      <div className="st-product-body">
        <h3 className="st-product-name">{name}</h3>
        <p className="st-product-desc">{description}</p>
        <div className="st-product-footer">
          <span className="st-product-price">
            {priceAmount}
            {pricePeriod && <span className="st-product-price-period">{pricePeriod}</span>}
          </span>
          <Link href={detailHref} className="st-product-cta">
            {m.inventory.viewDetails}
          </Link>
        </div>
      </div>
    </article>
  );
}

import Link from "next/link";
import Image from "next/image";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPlaceholderImage } from "@/lib/utils/placeholders";

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
  const isUnavailable = status.startsWith("Unavailable");

  const tone =
    isUnavailable
      ? "danger"
      : status === "Available"
        ? "success"
        : status === "Limited"
          ? "warning"
          : "default";

  const displayImage = imageUrl || getPlaceholderImage(category);

  return (
    <article
      className={`product-card${isUnavailable ? " product-card-unavailable" : ""}`}
    >
      <div className="product-media" style={{ position: "relative" }}>
        <Image
          src={displayImage}
          alt={name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="product-media-img"
        />
      </div>
      <div className="product-copy">
        <div className="price-row card-header-wrap" style={{ marginTop: 0 }}>
          <div className="kicker">{category}</div>
          <StatusBadge label={status} tone={tone} />
        </div>
        <h3 className="card-title-tight">{name}</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {description}
        </p>
        <div className="price-row action-row-inline">
          <strong>{price}</strong>
          <Link href={`/inventory/${slug}${date || zip ? `?${new URLSearchParams({ ...(date ? { date } : {}), ...(zip ? { zip } : {}) }).toString()}` : ""}`} className="secondary-btn">
            View Details
          </Link>
        </div>
      </div>
    </article>
  );
}

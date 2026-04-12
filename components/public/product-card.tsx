import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";

export function ProductCard({
  name,
  slug,
  price,
  category,
  description,
  status,
  imageUrl,
}: {
  name: string;
  slug: string;
  price: string;
  category: string;
  description: string;
  status: string;
  imageUrl?: string;
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

  return (
    <article
      className={`product-card${isUnavailable ? " product-card-unavailable" : ""}`}
    >
      <div className="product-media">
        {imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={name}
            className="product-media-img"
          />
        )}
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
          <Link href={`/inventory/${slug}`} className="secondary-btn">
            View Details
          </Link>
        </div>
      </div>
    </article>
  );
}

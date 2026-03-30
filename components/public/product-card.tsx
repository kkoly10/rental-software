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
  const tone =
    status === "Available"
      ? "success"
      : status === "Limited"
        ? "warning"
        : "default";

  return (
    <article className="product-card">
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
        <div className="price-row" style={{ marginTop: 0 }}>
          <div className="kicker">{category}</div>
          <StatusBadge label={status} tone={tone} />
        </div>
        <h3 style={{ margin: "8px 0 4px" }}>{name}</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {description}
        </p>
        <div className="price-row">
          <strong>{price}</strong>
          <Link href={`/inventory/${slug}`} className="secondary-btn">
            View Details
          </Link>
        </div>
      </div>
    </article>
  );
}
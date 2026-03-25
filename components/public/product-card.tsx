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
  imageUrl?: string | null;
}) {
  const tone =
    status === "Available"
      ? "success"
      : status === "Limited"
        ? "warning"
        : "default";

  return (
    <article className="product-card">
      {imageUrl ? (
        <div className="product-media" style={{ backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      ) : (
        <div className="product-media" />
      )}
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

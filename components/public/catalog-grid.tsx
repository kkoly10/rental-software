import { ProductCard } from "@/components/public/product-card";
import type { CatalogProduct } from "@/lib/types";

export function CatalogGrid({
  products,
}: {
  products: CatalogProduct[];
}) {
  return (
    <div className="grid grid-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          name={product.name}
          slug={product.slug}
          price={product.price}
          category={product.category}
          description={product.description}
          status={product.status}
          imageUrl={product.imageUrl}
        />
      ))}
    </div>
  );
}
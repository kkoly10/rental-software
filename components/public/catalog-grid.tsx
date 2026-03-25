import { ProductCard } from "@/components/public/product-card";

export function CatalogGrid({
  products,
}: {
  products: Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
    price: string;
    description: string;
    status: string;
    imageUrl?: string;
  }>;
}) {
  return (
    <div className="grid grid-3">
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
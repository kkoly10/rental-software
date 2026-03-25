import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { CatalogGrid } from "@/components/public/catalog-grid";
import { getCatalogList, getPublicCategories } from "@/lib/data/catalog-list";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const activeCategory = params.category ?? "";
  const [products, categories] = await Promise.all([
    getCatalogList(activeCategory || undefined),
    getPublicCategories(),
  ]);

  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container">
          <div className="section-header">
            <div>
              <div className="kicker">Catalog</div>
              <h1 style={{ margin: "6px 0 8px" }}>Browse inflatables</h1>
              <div className="muted">Filter by category to find the perfect rental.</div>
            </div>
          </div>

          <div className="filters">
            <Link
              href="/inventory"
              className={activeCategory ? "secondary-btn" : "primary-btn"}
              style={{ textDecoration: "none" }}
            >
              All
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/inventory?category=${cat.slug}`}
                className={activeCategory === cat.slug ? "primary-btn" : "secondary-btn"}
                style={{ textDecoration: "none" }}
              >
                {cat.name}
              </Link>
            ))}
          </div>

          {products.length === 0 ? (
            <div className="panel" style={{ textAlign: "center", padding: 32, marginTop: 16 }}>
              <strong>No products found</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                Try a different category or <Link href="/inventory">view all</Link>.
              </div>
            </div>
          ) : (
            <CatalogGrid products={products} />
          )}
        </div>
      </main>
    </>
  );
}

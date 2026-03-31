import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProductForm } from "@/components/products/product-form";
import { getCategories } from "@/lib/data/products";
import { getGuidanceSnapshot } from "@/lib/data/guidance-snapshot";

export default async function NewProductPage() {
  const [categories, snapshot] = await Promise.all([
    getCategories(),
    getGuidanceSnapshot(),
  ]);

  const isFirstProduct = snapshot.productsCount === 0;

  return (
    <DashboardShell
      title="Add Product"
      description="Create a new rentable item for the public catalog and booking flow."
    >
      {isFirstProduct && (
        <div
          className="panel"
          style={{
            marginBottom: 20,
            padding: "18px 22px",
            background: "var(--surface-muted)",
            borderLeft: "4px solid #f97316",
          }}
        >
          <strong style={{ fontSize: 15 }}>Creating your first product!</strong>
          <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
            Here&apos;s what works well:
          </div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.8, fontSize: 14, color: "var(--text-soft)" }}>
            <li><strong>Name:</strong> Use what customers search for (e.g., &quot;Rainbow Bounce House&quot; not &quot;Product A&quot;)</li>
            <li><strong>Price:</strong> Check local competitors — most bounce houses rent for $150–300/day</li>
            <li><strong>Description:</strong> Include dimensions, age range, and capacity</li>
            <li>Keep <strong>&quot;Active&quot;</strong> checked so it appears on your storefront immediately</li>
          </ul>
        </div>
      )}

      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Catalog creation</div>
            <h2 style={{ margin: "6px 0 0" }}>New inflatable product</h2>
          </div>
        </div>
        <ProductForm categories={categories} />
      </section>
    </DashboardShell>
  );
}

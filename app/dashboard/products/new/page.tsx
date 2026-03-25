import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProductForm } from "@/components/products/product-form";
import { getCategories } from "@/lib/data/products";

export default async function NewProductPage() {
  const categories = await getCategories();

  return (
    <DashboardShell
      title="Add Product"
      description="Create a new rentable item for the public catalog and booking flow."
    >
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

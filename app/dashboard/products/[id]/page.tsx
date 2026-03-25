import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProductForm } from "@/components/products/product-form";
import { ProductImageManager } from "@/components/products/product-images";
import { getProductById, getCategories } from "@/lib/data/products";
import { notFound } from "next/navigation";

export default async function ProductDetailEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProductById(id),
    getCategories(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <DashboardShell
      title="Edit Product"
      description="Edit pricing, specs, availability rules, and public catalog content."
    >
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Catalog item</div>
              <h2 style={{ margin: "6px 0 0" }}>{product.name}</h2>
            </div>
          </div>
          <ProductForm product={product} categories={categories} />
        </section>

        <aside>
          <div className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">Quick info</div>
                <h2 style={{ margin: "6px 0 0" }}>Current settings</h2>
              </div>
            </div>
            <div className="list">
              <div className="order-card">Base price: ${product.basePrice}/day</div>
              <div className="order-card">Security deposit: ${product.securityDeposit}</div>
              <div className="order-card">Category: {product.category}</div>
              <div className="order-card">Delivery: {product.requiresDelivery ? "Required" : "Optional"}</div>
              <div className="order-card">Status: {product.isActive ? "Active" : "Hidden"}</div>
            </div>
            <div style={{ marginTop: 16 }}>
              <Link href={`/inventory/${product.slug}`} className="secondary-btn">
                View public page
              </Link>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 18 }}>
            <div className="section-header">
              <div>
                <div className="kicker">Media</div>
                <h2 style={{ margin: "6px 0 0" }}>Product images</h2>
              </div>
            </div>
            <ProductImageManager productId={product.id} images={product.images} />
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProductForm } from "@/components/products/product-form";
import { ProductImageManager } from "@/components/products/product-image-manager";
import { AssetManager } from "@/components/products/asset-manager";
import { getProductById, getCategories } from "@/lib/data/products";
import { getProductImages } from "@/lib/data/product-images";
import { getProductAssets } from "@/lib/data/product-assets";
import { getTranslator } from "@/lib/i18n/server";

export default async function ProductDetailEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; asset_pending?: string }>;
}) {
  const { id } = await params;
  const { created, asset_pending } = await searchParams;
  const justCreated = created === "1";
  const assetPending = asset_pending === "1";
  const [product, categories, images, assets, { messages: m, t }] = await Promise.all([
    getProductById(id),
    getCategories(),
    getProductImages(id),
    getProductAssets(id),
    getTranslator(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <DashboardShell
      title={m.dashboard.productDetail.title}
      description={m.dashboard.productDetail.description}
    >
      {justCreated && !assetPending && (
        <div className="panel" style={{ background: "var(--success-bg, #e6f9e6)", border: "1px solid var(--success-border, #b3e6b3)", marginBottom: 16 }}>
          <strong>{m.dashboard.products.detail.productCreatedBanner}</strong> {m.dashboard.products.detail.productCreatedBody}
        </div>
      )}
      {assetPending && (
        <div className="panel" style={{ background: "#fff4e5", border: "1px solid #f5a623", marginBottom: 16 }} role="alert">
          <strong>Product created, but the first asset couldn&apos;t be added automatically.</strong>{" "}
          Products with zero ready assets can&apos;t be booked. Add one in the Assets section below to enable bookings.
        </div>
      )}

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.products.detail.kicker}</div>
              <h2 style={{ margin: "6px 0 0" }}>{product.name}</h2>
            </div>
          </div>

          <ProductForm product={product} categories={categories} />

          <div style={{ marginTop: 18 }}>
            <ProductImageManager productId={product.id} images={images} />
          </div>

          <AssetManager productId={product.id} assets={assets} />
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.products.detail.quickInfoKicker}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.products.detail.currentSettings}</h2>
            </div>
          </div>

          <div className="list">
            <div className="order-card">{m.dashboard.products.detail.basePrice}: ${product.basePrice}/{m.dashboard.products.detail.perDay}</div>
            <div className="order-card">{m.dashboard.products.detail.securityDeposit}: ${product.securityDeposit}</div>
            <div className="order-card">{m.dashboard.products.detail.category}: {product.category}</div>
            <div className="order-card">
              {m.dashboard.products.detail.delivery}: {product.requiresDelivery ? m.dashboard.products.detail.required : m.dashboard.products.detail.optional}
            </div>
            <div className="order-card">
              {m.dashboard.products.detail.status}: {product.isActive ? m.dashboard.products.detail.published : m.dashboard.products.detail.hidden}
            </div>
            <div className="order-card">
              {m.dashboard.products.detail.images}: {t(m.dashboard.products.detail.imagesUploaded, { count: images.length })}
            </div>
            <div className="order-card">
              Inventory: {assets.filter((a) => a.isAvailable).length} ready / {assets.length} total
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Link href={`/inventory/${product.slug}`} className="secondary-btn">
              {m.dashboard.products.detail.viewPublicPage}
            </Link>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
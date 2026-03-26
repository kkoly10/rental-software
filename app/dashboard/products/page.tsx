import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getProducts } from "@/lib/data/products";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";

export default async function ProductsPage() {
  const products = await getProducts();
  const guidanceState = await getGuidanceState();
  const helpConfig = pageHelpMap["/dashboard/products"];

  return (
    <DashboardShell
      title="Products"
      description="Manage public catalog items, pricing, categories, and rental readiness."
    >
      {helpConfig && (
        <ContextHelpBanner config={helpConfig} dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false} />
      )}
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Catalog management</div>
            <h2 style={{ margin: "6px 0 0" }}>Product inventory</h2>
          </div>
          <Link href="/dashboard/products/new" className="primary-btn">
            Add product
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
            <strong>No products yet</strong>
            <div className="muted" style={{ marginTop: 8 }}>
              Add your first inflatable product to start building your catalog.
            </div>
            <div style={{ marginTop: 12 }}>
              <Link href="/dashboard/products/new" className="primary-btn">
                Add your first product
              </Link>
            </div>
          </div>
        ) : (
          <div className="list">
            {products.map((product) => (
              <Link key={product.id} href={`/dashboard/products/${product.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <article className="order-card">
                  <div className="order-row">
                    <div>
                      <strong>{product.name}</strong>
                      <div className="muted">{product.category}</div>
                    </div>
                    <StatusBadge
                      label={product.status}
                      tone={product.tone as "default" | "success" | "warning"}
                    />
                  </div>
                  <div className="price-row">
                    <span className="muted">{product.price}</span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

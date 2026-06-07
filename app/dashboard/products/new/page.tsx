import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProductForm } from "@/components/products/product-form";
import { getCategories } from "@/lib/data/products";
import { getGuidanceSnapshot } from "@/lib/data/guidance-snapshot";
import { getMessages } from "@/lib/i18n/server";
import { getStarterExample } from "@/lib/verticals/empty-states";
import { getPrimaryVerticalSlug } from "@/lib/verticals/org-verticals";

export default async function NewProductPage() {
  const [categories, snapshot, m, primaryVertical] = await Promise.all([
    getCategories(),
    getGuidanceSnapshot(),
    getMessages(),
    getPrimaryVerticalSlug(),
  ]);

  const isFirstProduct = snapshot.productsCount === 0;
  // Phase 4b — vertical-specific starter via the join-table helper
  // (falls back to organizations.business_type for pre-backfill orgs).
  const starter = getStarterExample(primaryVertical ?? undefined);

  return (
    <DashboardShell
      title={m.dashboard.newProduct.title}
      description={m.dashboard.newProduct.description}
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
          <strong style={{ fontSize: 15 }}>{m.dashboard.products.firstProductBanner.title}</strong>
          <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
            {m.dashboard.products.firstProductBanner.intro}
          </div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.8, fontSize: 14, color: "var(--text-soft)" }}>
            {m.dashboard.products.firstProductBanner.tips.map((tip, idx) => (
              <li key={idx}>
                <strong>{tip.strong}</strong> {tip.body}
              </li>
            ))}
          </ul>
          {starter && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                background: "var(--surface)",
                border: "1px dashed var(--border, #e5e7eb)",
                borderRadius: 8,
              }}
            >
              <div
                className="kicker"
                style={{ marginBottom: 6 }}
              >
                Starter example
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                <div>
                  <strong>Name:</strong> {starter.name}
                </div>
                <div>
                  <strong>Price:</strong> {starter.price}
                </div>
                <div>
                  <strong>Description:</strong> {starter.description}
                </div>
              </div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                Copy this as a template and tweak — your real prices /
                sizes go in below.
              </div>
            </div>
          )}
        </div>
      )}

      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">{m.dashboard.products.newProductKicker}</div>
            <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.products.newProductSectionTitle}</h2>
          </div>
        </div>
        <ProductForm categories={categories} />
      </section>
    </DashboardShell>
  );
}

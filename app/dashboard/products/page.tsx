import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getProductsPage } from "@/lib/data/products";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";
import { ListSearchForm } from "@/components/dashboard/list-search-form";
import { ListPagination } from "@/components/dashboard/list-pagination";
import { CsvImportButton } from "@/components/products/csv-import-button";
import { getTranslator } from "@/lib/i18n/server";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const [productsPage, guidanceState, { messages: m, t }] = await Promise.all([
    getProductsPage({ query: params.q, page: params.page }),
    getGuidanceState(),
    getTranslator(),
  ]);
  const helpConfig = pageHelpMap["/dashboard/products"];

  return (
    <DashboardShell
      title={m.dashboard.products.title}
      description={m.dashboard.products.description}
    >
      {helpConfig && (
        <ContextHelpBanner
          config={helpConfig}
          dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false}
        />
      )}

      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">{m.dashboard.products.kicker}</div>
            <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.products.sectionTitle}</h2>
            <div className="muted" style={{ marginTop: 8 }}>
              {t(productsPage.totalItems === 1 ? m.dashboard.products.matchingFound : m.dashboard.products.matchingFoundPlural, { count: productsPage.totalItems })}
            </div>
          </div>
          <div className="action-row">
            <CsvImportButton />
            <Link href="/dashboard/products/new" className="primary-btn">
              {m.dashboard.products.newProduct}
            </Link>
          </div>
        </div>

        <ListSearchForm
          placeholder={m.dashboard.products.searchPlaceholder}
          initialQuery={productsPage.query}
        />

        {productsPage.items.length === 0 ? (
          productsPage.query ? (
            <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
              <strong>{m.dashboard.products.noProductsFound}</strong>
              <div className="muted" style={{ marginTop: 8 }}>{m.common.tryDifferentSearch}</div>
            </div>
          ) : (
            <EmptyState
              icon="products"
              title={m.dashboard.products.noProductsYet}
              description={m.dashboard.products.noProductsYetDescription}
              actionLabel={m.dashboard.products.createProduct}
              actionHref="/dashboard/products/new"
            />
          )
        ) : (
          <>
            <div className="list">
              {productsPage.items.map((product) => (
                <Link
                  key={product.id}
                  href={`/dashboard/products/${product.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <article className="order-card">
                    <div className="order-row">
                      <div>
                        <strong>{product.name}</strong>
                        <div className="muted">{product.category}</div>
                      </div>
                      <StatusBadge
                        label={product.status}
                        tone={product.tone as "default" | "success" | "warning" | "danger"}
                      />
                    </div>
                    <div className="price-row">
                      <span className="muted">{product.price}</span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            <ListPagination
              pathname="/dashboard/products"
              page={productsPage.page}
              totalPages={productsPage.totalPages}
              query={productsPage.query}
            />
          </>
        )}
      </section>
    </DashboardShell>
  );
}
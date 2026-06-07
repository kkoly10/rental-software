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
import { getEmptyStateCopy } from "@/lib/verticals/empty-states";
import { getPrimaryVerticalSlug } from "@/lib/verticals/org-verticals";

// Tinted placeholder glyph for products without a photo yet (Patch 4 grid).
function BoxGlyph() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const [productsPage, guidanceState, { messages: m, t }, primaryVertical] = await Promise.all([
    getProductsPage({ query: params.q, page: params.page }),
    getGuidanceState(),
    getTranslator(),
    getPrimaryVerticalSlug(),
  ]);
  const helpConfig = pageHelpMap["/dashboard/products"];
  // Phase 4b — primary vertical from organization_verticals (with
  // business_type fallback baked into the helper) so multi-vertical
  // orgs can later choose which one drives empty-state copy without
  // touching this page.
  const verticalCopy = getEmptyStateCopy(primaryVertical ?? undefined, "products");
  const emptyStateTitle =
    verticalCopy?.title ?? m.dashboard.products.noProductsYet;
  const emptyStateDescription =
    verticalCopy?.description ??
    m.dashboard.products.noProductsYetDescription;
  const emptyStateActionLabel =
    verticalCopy?.actionLabel ?? m.dashboard.products.createProduct;

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
            <div className="entity-row" style={{ justifyContent: "center", padding: 32 }}>
              <div style={{ textAlign: "center" }}>
                <strong>{m.dashboard.products.noProductsFound}</strong>
                <div className="muted" style={{ marginTop: 8 }}>{m.common.tryDifferentSearch}</div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon="products"
              title={emptyStateTitle}
              description={emptyStateDescription}
              actionLabel={emptyStateActionLabel}
              actionHref="/dashboard/products/new"
            />
          )
        ) : (
          <>
            <div className="catalog-tiles" style={{ marginTop: 14 }}>
              {productsPage.items.map((product) => (
                <Link
                  key={product.id}
                  href={`/dashboard/products/${product.id}`}
                  className="catalog-tile"
                >
                  <div className="catalog-tile__thumb">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt={product.name} />
                    ) : (
                      <div className="catalog-tile__ph"><BoxGlyph /></div>
                    )}
                    <span className="catalog-tile__status">
                      <StatusBadge
                        label={product.status}
                        tone={product.tone as "default" | "success" | "warning" | "danger"}
                      />
                    </span>
                  </div>
                  <div className="catalog-tile__body">
                    <div className="catalog-tile__cat">{product.category}</div>
                    <div className="catalog-tile__name">{product.name}</div>
                    <div className="catalog-tile__foot">
                      <span className="catalog-tile__price">{product.price}</span>
                      {product.missingPrice && (
                        <StatusBadge label={m.dashboard.products.unpriced} tone="warning" />
                      )}
                    </div>
                  </div>
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

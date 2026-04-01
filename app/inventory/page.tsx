import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { CatalogGrid } from "@/components/public/catalog-grid";
import { CatalogFilterForm } from "@/components/public/catalog-filter-form";
import { getCatalogList } from "@/lib/data/catalog-list";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { buildPageMetadata } from "@/lib/seo/metadata";

function normalizeCategory(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/\s+/g, "-");
}

function formatCategoryLabel(value?: string) {
  if (!value) return "";
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getOrganizationSettings();

  return buildPageMetadata({
    title: `${settings.businessName} Inventory`,
    description: `Browse bounce houses, water slides, and party rentals from ${settings.businessName}. Serving ${settings.serviceAreaLabel}.`,
    path: "/inventory",
  });
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    zip?: string;
    category?: string;
  }>;
}) {
  await requirePublicOrg();

  const params = await searchParams;
  const products = await getCatalogList();

  const filteredProducts = params.category
    ? products.filter(
        (product) => normalizeCategory(product.category) === params.category
      )
    : products;

  return (
    <>
      <PublicHeader />

      <main className="page">
        <div className="container">
          <section className="panel" style={{ padding: 24 }}>
            <div className="section-header">
              <div>
                <div className="kicker">Catalog</div>
                <h1 style={{ margin: "6px 0 8px" }}>
                  Browse inflatables by event type
                </h1>
                <div className="muted">
                  Search by date, delivery ZIP, and category to narrow down the
                  best fits for your party.
                </div>

                <div className="storefront-context-pills">
                  {params.date ? (
                    <span className="storefront-context-pill">
                      Date: {params.date}
                    </span>
                  ) : null}
                  {params.zip ? (
                    <span className="storefront-context-pill">
                      ZIP: {params.zip}
                    </span>
                  ) : null}
                  {params.category ? (
                    <span className="storefront-context-pill">
                      Category: {formatCategoryLabel(params.category)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <CatalogFilterForm
              initialDate={params.date}
              initialZip={params.zip}
              initialCategory={params.category}
            />
          </section>

          <section className="section">
            <div className="section-header">
              <div>
                <div className="kicker">Available rentals</div>
                <h2>
                  {filteredProducts.length} option
                  {filteredProducts.length === 1 ? "" : "s"} for your event
                </h2>
              </div>
            </div>

            {filteredProducts.length > 0 ? (
              <CatalogGrid products={filteredProducts} />
            ) : (
              <div className="panel storefront-empty-state">
                <div className="kicker">No direct matches</div>
                <h2 style={{ margin: "8px 0 10px" }}>
                  Try broadening your filters
                </h2>
                <div className="muted">
                  We could not find rentals that matched the current category
                  and availability filters. Adjust the date, ZIP, or category
                  and try again.
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <PublicFooter />
    </>
  );
}
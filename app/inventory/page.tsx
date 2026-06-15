import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { DemoBanner } from "@/components/demo/demo-banner";
import { isCurrentTenantDemo } from "@/lib/demo/context";
import { CatalogControls } from "@/components/public/catalog-controls";
import { CatalogFilterForm } from "@/components/public/catalog-filter-form";
import { SectionHead } from "@/components/public/themes/party-classic/section-head";
import { getCatalogList } from "@/lib/data/catalog-list";
import { enrichCatalogAvailability } from "@/lib/data/catalog-availability";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { getCategoryGridItems } from "@/lib/data/category-grid";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicPrimaryVerticalSlug } from "@/lib/verticals/storefront-defaults";
import { isGeneralVertical } from "@/lib/verticals/customer-language";

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

  return await buildPageMetadata({
    title: `${settings.businessName} Inventory`,
    description: `Browse rentals from ${settings.businessName}. Serving ${settings.serviceAreaLabel}.`,
    path: "/inventory",
    siteName: settings.businessName,
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
  const isDemo = await isCurrentTenantDemo();

  const params = await searchParams;
  const [products, categoryItems, settings, { messages: m, t }, verticalSlug] = await Promise.all([
    getCatalogList(),
    getCategoryGridItems().catch(() => []),
    getOrganizationSettings(),
    getTranslator(),
    getPublicPrimaryVerticalSlug(),
  ]);

  // General ("other") operators rent tools / AV / furniture, not "events" —
  // swap the event-framed browse copy for neutral variants. Event verticals
  // keep their existing copy unchanged.
  const general = isGeneralVertical(verticalSlug);
  const inv = m.inventory;
  const browseTitle = general ? inv.browseByEventTypeGeneral : inv.browseByEventType;
  const browseIntro = general ? inv.filterIntroGeneral : inv.filterIntro;
  const dateHint = general ? inv.pickDateHintGeneral : inv.pickDateHint;
  const optionSingleCopy = general ? inv.optionSingleGeneral : inv.optionSingle;
  const optionsCountMsg = general ? inv.optionsCountGeneral : inv.optionsCount;
  const availabilityCountMsg = general ? inv.availabilityCountGeneral : inv.availabilityCount;

  const categoryOptions = categoryItems.map((cat) => ({
    value: cat.slug,
    label: cat.name,
  }));

  // Filter by category
  const categoryFiltered = params.category
    ? products.filter(
        (product) => normalizeCategory(product.category) === params.category
      )
    : products;

  // Enrich with real-time availability and ZIP validation
  const { products: enrichedProducts, zipValid, zipMessage } =
    await enrichCatalogAvailability(categoryFiltered, params.date, params.zip);

  // Sort: available products first, unavailable last
  const sortedProducts = [...enrichedProducts].sort((a, b) => {
    const aUnavailable = a.status.startsWith("Unavailable");
    const bUnavailable = b.status.startsWith("Unavailable");
    if (aUnavailable && !bUnavailable) return 1;
    if (!aUnavailable && bUnavailable) return -1;
    return 0;
  });

  const availableCount = sortedProducts.filter(
    (p) => !p.status.startsWith("Unavailable")
  ).length;

  const showDeliversTo =
    settings.serviceAreaLabel && settings.serviceAreaLabel !== "Your service area";

  return (
    <>
      <PublicHeader />

      <main id="main">
        {/* Page head + filter bar */}
        <section className="st-container st-catalog-head">
          <span className="st-eyebrow">{m.inventory.title}</span>
          <h1 className="st-section-title">{browseTitle}</h1>
          <p className="st-section-sub">{browseIntro}</p>

          <CatalogFilterForm
            initialDate={params.date}
            initialZip={params.zip}
            initialCategory={params.category}
            categories={categoryOptions}
          />

          <div className="st-context-chips">
            {params.date ? (
              <span className="st-context-chip">
                {t(m.inventory.pillDate, { value: params.date })}
              </span>
            ) : null}
            {params.zip ? (
              <span className="st-context-chip">
                {t(m.inventory.pillZip, { value: params.zip })}
              </span>
            ) : null}
            {params.category ? (
              <span className="st-context-chip">
                {t(m.inventory.pillCategory, { value: formatCategoryLabel(params.category) })}
              </span>
            ) : null}
          </div>

          {showDeliversTo && (
            <p className="st-note" role="note">
              {t(m.inventory.deliversTo, { area: settings.serviceAreaLabel })}
            </p>
          )}

          {!params.date && sortedProducts.length > 0 && (
            <p className="st-note" role="note">
              {dateHint}
            </p>
          )}

          {zipValid === false && zipMessage && (
            <p className="st-note st-note--warning" role="alert">
              {zipMessage}
            </p>
          )}
        </section>

        {/* Results */}
        <section className="st-container st-section">
          <SectionHead
            kicker={params.date ? m.inventory.availabilityResults : m.inventory.availableRentals}
            title={
              params.date
                ? t(availabilityCountMsg, { available: availableCount, total: sortedProducts.length })
                : sortedProducts.length === 1
                  ? optionSingleCopy
                  : t(optionsCountMsg, { count: sortedProducts.length })
            }
          />

          {sortedProducts.length > 0 ? (
            <CatalogControls products={sortedProducts} date={params.date} zip={params.zip} />
          ) : (
            <div className="st-empty-state">
              <span className="st-eyebrow">{m.inventory.noMatchesKicker}</span>
              <h2 className="st-empty-state-title">{m.inventory.noMatchesTitle}</h2>
              <p className="st-empty-state-body">{m.inventory.noMatchesBody}</p>
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
      {isDemo && <DemoBanner />}
    </>
  );
}

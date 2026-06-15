import { getServiceAreasGeo } from "@/lib/data/service-areas-geo";
import { getTranslator } from "@/lib/i18n/server";
import { SectionHead } from "@/components/public/themes/party-classic/section-head";
import { ServiceAreaMap } from "@/components/maps/service-area-map";

/**
 * Editorial coverage section — left column kicker + H2 + lede + plain
 * ZIP list (no pills, no borders). Right column hosts the real
 * Leaflet-driven service-area map (lazy-loaded on the client), styled
 * to fit the editorial container.
 *
 * The original storefront rendered this via the legacy ServiceAreaSection
 * component which got dropped during the editorial rebuild — this
 * restores the real Leaflet map per operator service-area geocoding
 * while keeping the editorial composition.
 */
export async function PartyClassicServiceArea({
  heading,
  intro,
}: {
  heading?: string;
  intro?: string;
} = {}) {
  const [areas, { messages: m }] = await Promise.all([
    getServiceAreasGeo(),
    getTranslator(),
  ]);

  if (areas.length === 0) return null;

  const displayLimit = 8;
  const displayed = areas.slice(0, displayLimit);
  const remaining = areas.length - displayed.length;

  return (
    <section className="st-section st-section-rule st-coverage">
      <div className="st-container st-coverage-grid">
        <div className="st-coverage-text">
          <SectionHead
            kicker={m.storefront.serviceArea.kicker}
            title={heading || m.storefront.serviceArea.title}
            sub={intro || m.storefront.serviceArea.description}
          />
          <div className="st-zip-list">
            {displayed.map((a) => (
              <div key={a.id} className="st-zip-entry">
                <strong>{a.zipCode}</strong>
                {a.city && <span>{a.city}</span>}
              </div>
            ))}
            {remaining > 0 && (
              <div className="st-zip-entry st-zip-more">
                <strong>+{remaining}</strong>
                <span>more</span>
              </div>
            )}
          </div>
          <p className="st-coverage-footnote">{m.storefront.serviceArea.notListed}</p>
        </div>
        <div className="st-coverage-map-frame">
          <ServiceAreaMap areas={areas} height="100%" />
        </div>
      </div>
    </section>
  );
}

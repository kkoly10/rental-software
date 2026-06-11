import { getServiceAreasGeo } from "@/lib/data/service-areas-geo";
import { getTranslator } from "@/lib/i18n/server";
import { SectionHead } from "@/components/public/themes/party-classic/section-head";

/**
 * Quietly random map-pin positions derived from the ZIP digit so each
 * ZIP always lands at the same spot on the abstract warm map. Pure
 * visual — real geocoding is out of scope.
 */
function pinPosition(zip: string, index: number) {
  let h = 0;
  for (let i = 0; i < zip.length; i++) h = (h * 31 + zip.charCodeAt(i)) & 0xffff;
  const x = 24 + (((h % 50) + index * 7) % 52);
  const y = 28 + ((((h >> 4) % 44) + index * 11) % 44);
  return { left: `${x}%`, top: `${y}%` };
}

/**
 * Editorial coverage section — left column kicker + H2 + lede + plain
 * ZIP list (no pills, no borders). Right column a quiet warm-gradient
 * abstract map with olive dots.
 *
 * Per spec §5.8.
 */
export async function PartyClassicServiceArea() {
  const [areas, { messages: m, t }] = await Promise.all([
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
            title={m.storefront.serviceArea.title}
            sub={m.storefront.serviceArea.description}
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
                <span>{t(m.storefront.serviceArea.moreZipsCount, { count: remaining })}</span>
              </div>
            )}
          </div>
          <p className="st-coverage-footnote">{m.storefront.serviceArea.notListed}</p>
        </div>
        <div className="st-coverage-map" aria-hidden="true">
          {displayed.slice(0, 5).map((a, i) => (
            <span key={`pin-${a.id}`} className="st-coverage-pin" style={pinPosition(a.zipCode, i)} />
          ))}
        </div>
      </div>
    </section>
  );
}

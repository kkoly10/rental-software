import { getServiceAreasGeo } from "@/lib/data/service-areas-geo";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getTranslator } from "@/lib/i18n/server";

// Pseudo-random map pin positions derived from the ZIP string so each ZIP
// always lands at the same spot on the abstract map without us needing real
// geocoding for the redesign. Pure visual — operators with a real map need
// service_areas.geo_centroid which is a future migration.
function pinPosition(zip: string, index: number) {
  let h = 0;
  for (let i = 0; i < zip.length; i++) h = (h * 31 + zip.charCodeAt(i)) & 0xffff;
  const x = 20 + ((h % 60) + index * 7) % 60;
  const y = 25 + (((h >> 4) % 50) + index * 11) % 50;
  return { left: `${x}%`, top: `${y}%` };
}

export async function PartyClassicServiceArea() {
  const [areas, settings, { messages: m }] = await Promise.all([
    getServiceAreasGeo(),
    getOrganizationSettings(),
    getTranslator(),
  ]);

  if (areas.length === 0) return null;

  // Display up to 7 ZIP pills; the rest collapse into a "+N more" pill so a
  // 50-ZIP service area doesn't dominate the page.
  const displayLimit = 7;
  const displayed = areas.slice(0, displayLimit);
  const remaining = areas.length - displayed.length;

  return (
    <section className="st-container st-section">
      <div className="st-service-card">
        <div className="st-service-text">
          <div>
            <span className="st-service-kicker">{m.storefront.serviceArea.kicker}</span>
            <h2 className="st-service-title">
              {settings.businessName
                ? `${settings.businessName} delivers across your area`
                : m.storefront.serviceArea.title}
            </h2>
          </div>
          <p className="st-service-body">{m.storefront.serviceArea.description}</p>
          <div className="st-zip-grid">
            {displayed.map((a) => {
              const locale = [a.city, a.state].filter(Boolean).join(", ");
              const label = locale ? `${a.zipCode} ${a.city ?? ""}`.trim() : a.zipCode;
              return (
                <span key={a.id} className="st-zip-pill">
                  {label}
                </span>
              );
            })}
            {remaining > 0 && (
              <span className="st-zip-pill more">
                {m.storefront.serviceArea.moreZipsCount.replace("{count}", String(remaining))}
              </span>
            )}
          </div>
          <p
            className="st-service-body"
            style={{ marginTop: "var(--st-space-2)", fontSize: "13.5px" }}
          >
            {m.storefront.serviceArea.notListed}
          </p>
        </div>
        <div className="st-service-map">
          <div className="st-map-grid" />
          {displayed.slice(0, 5).map((a, i) => (
            <div key={`pin-${a.id}`} className="st-map-pin" style={pinPosition(a.zipCode, i)} />
          ))}
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { ServiceAreaMap } from "@/components/maps/service-area-map";
import { getTranslator } from "@/lib/i18n/server";

type ServiceAreaGeo = {
  id: string;
  label: string;
  zipCode: string;
  city?: string;
  state?: string;
  deliveryFee: number;
  minimumOrder: number;
};

type Props = {
  areas?: ServiceAreaGeo[];
};

export async function ServiceAreaSection({ areas = [] }: Props) {
  const { messages: m, t } = await getTranslator();
  const coverageLabel = areas.length > 0
    ? areas
        .map((a) => a.label || [a.city, a.state].filter(Boolean).join(", "))
        .filter(Boolean)
        .slice(0, 5)
        .join(", ")
    : null;

  return (
    <section className="section">
      <div className="container">
        <div className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.storefront.serviceArea.kicker}</div>
              <h2 style={{ margin: "6px 0 8px" }}>{m.storefront.serviceArea.title}</h2>
              <div className="muted">
                {m.storefront.serviceArea.description}
              </div>
            </div>
          </div>

          <div className="grid grid-3">
            <div className="order-card">
              <strong>{m.storefront.serviceArea.primaryCoverage}</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {coverageLabel
                  ? t(m.storefront.serviceArea.coverageServing, { areas: coverageLabel })
                  : m.storefront.serviceArea.coverageContact}
              </div>
            </div>
            <div className="order-card">
              <strong>{m.storefront.serviceArea.setupSupport}</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {m.storefront.serviceArea.setupSupportBody}
              </div>
            </div>
            <div className="order-card">
              <strong>{m.storefront.serviceArea.needHelp}</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {m.storefront.serviceArea.needHelpBody}
              </div>
              <div style={{ marginTop: 14 }}>
                <Link href="/inventory" className="secondary-btn">{m.storefront.serviceArea.browseCatalog}</Link>
              </div>
            </div>
          </div>

          {areas.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 className="svc-map-heading">{m.storefront.serviceArea.mapHeading}</h3>
              <ServiceAreaMap areas={areas} height="400px" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

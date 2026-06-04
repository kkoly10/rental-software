import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  getServiceAreaAdminRecords,
  findServiceAreaOverlaps,
} from "@/lib/data/service-areas-admin";
import { getServiceAreasGeo } from "@/lib/data/service-areas-geo";
import { ServiceAreaManager } from "@/components/service-areas/service-area-manager";
import { ServiceAreaMapPanel } from "@/components/service-areas/service-area-map-panel";
import { getMessages } from "@/lib/i18n/server";

export default async function ServiceAreasPage() {
  const [areas, geoAreas, m] = await Promise.all([
    getServiceAreaAdminRecords(),
    getServiceAreasGeo(),
    getMessages(),
  ]);

  // Find overlapping coverage so the operator can clean it up. The lookup
  // function uses a deterministic tie-breaker (most-recently-updated) when
  // it hits ambiguous matches, but the root-cause is still a config issue
  // the operator should fix.
  const overlaps = findServiceAreaOverlaps(areas);

  return (
    <DashboardShell
      title={m.dashboard.serviceAreas.title}
      description={m.dashboard.serviceAreas.description}
    >
      {overlaps.length > 0 && (
        <div
          className="badge warning"
          role="alert"
          style={{
            padding: "12px 16px",
            marginBottom: 12,
            display: "block",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong>{m.dashboard.serviceAreas.overlapHeadline}</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {overlaps.slice(0, 5).map((o, i) => (
              <li key={`${o.kind}-${o.label}-${i}`}>
                {o.kind === "city_state"
                  ? `${m.dashboard.serviceAreas.overlapCityState}: ${o.label}`
                  : `${m.dashboard.serviceAreas.overlapPostal}: ${o.label}`}
              </li>
            ))}
            {overlaps.length > 5 && (
              <li>{m.dashboard.serviceAreas.overlapMore}</li>
            )}
          </ul>
        </div>
      )}

      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">{m.dashboard.serviceAreas.kicker}</div>
            <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.serviceAreas.sectionTitle}</h2>
            <div className="muted" style={{ marginTop: 8 }}>
              {m.dashboard.serviceAreas.sectionBody}
            </div>
          </div>
        </div>

        <ServiceAreaManager areas={areas} />
      </section>

      <ServiceAreaMapPanel areas={geoAreas} />
    </DashboardShell>
  );
}
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getServiceAreaAdminRecords } from "@/lib/data/service-areas-admin";
import { getServiceAreasGeo } from "@/lib/data/service-areas-geo";
import { ServiceAreaManager } from "@/components/service-areas/service-area-manager";
import { ServiceAreaMapPanel } from "@/components/service-areas/service-area-map-panel";

export default async function ServiceAreasPage() {
  const [areas, geoAreas] = await Promise.all([
    getServiceAreaAdminRecords(),
    getServiceAreasGeo(),
  ]);

  return (
    <DashboardShell
      title="Service Areas"
      description="Manage delivery coverage, ZIP rules, fees, and minimum order requirements."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Delivery coverage</div>
            <h2 style={{ margin: "6px 0 0" }}>Configured service areas</h2>
            <div className="muted" style={{ marginTop: 8 }}>
              Service areas are organization-specific. Each rental business can
              configure its own U.S. delivery ZIPs, fees, and minimum order rules.
            </div>
          </div>
        </div>

        <ServiceAreaManager areas={areas} />
      </section>

      <ServiceAreaMapPanel areas={geoAreas} />
    </DashboardShell>
  );
}
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getServiceAreas } from "@/lib/data/service-areas";

export default async function ServiceAreasPage() {
  const areas = await getServiceAreas();

  return (
    <DashboardShell
      title="Service Areas"
      description="Manage ZIP coverage, delivery fees, and minimum order rules."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Delivery coverage</div>
            <h2 style={{ margin: "6px 0 0" }}>Configured service areas</h2>
          </div>
        </div>

        <div className="list">
          {areas.map((area) => (
            <article key={area.id} className="order-card">
              <strong>{area.name}</strong>
              <div className="muted">Delivery fee: {area.fee}</div>
              <div className="muted">{area.minimum}</div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
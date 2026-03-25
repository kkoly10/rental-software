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

        {areas.length === 0 ? (
          <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
            <strong>No service areas configured</strong>
            <div className="muted" style={{ marginTop: 8 }}>
              Service areas are created during onboarding. You can add more by configuring ZIP-based coverage rules.
            </div>
          </div>
        ) : (
          <div className="list">
            {areas.map((area) => (
              <article key={area.id} className="order-card">
                <div className="order-row">
                  <strong>{area.name}</strong>
                  <strong>{area.fee}</strong>
                </div>
                <div className="muted">{area.minimum}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

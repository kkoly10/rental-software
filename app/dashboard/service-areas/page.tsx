import { DashboardShell } from "@/components/layout/dashboard-shell";

const areas = [
  {
    name: "Stafford 22554",
    fee: "$20",
    minimum: "$125 minimum",
  },
  {
    name: "Fredericksburg 22401",
    fee: "$30",
    minimum: "$150 minimum",
  },
  {
    name: "Northern Virginia zone",
    fee: "$55",
    minimum: "$250 minimum",
  },
];

export default function ServiceAreasPage() {
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
            <article key={area.name} className="order-card">
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

import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getRouteDetail } from "@/lib/data/route-detail";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const route = await getRouteDetail(id);

  return (
    <DashboardShell
      title="Route Detail"
      description="Inspect a delivery route, crew assignment, stops, and completion state."
    >
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Route overview</div>
              <h2 style={{ margin: "6px 0 0" }}>{route.name}</h2>
            </div>
          </div>

          <div className="list">
            <div className="order-card">
              <strong>Assigned crew</strong>
              <div className="muted">{route.crewLabel}</div>
            </div>

            <div className="order-card">
              <strong>Vehicle</strong>
              <div className="muted">{route.vehicleLabel}</div>
            </div>

            <div className="order-card">
              <strong>Stops</strong>
              <div className="muted">{route.summaryLabel}</div>
            </div>
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Stop list</div>
              <h2 style={{ margin: "6px 0 0" }}>Today's sequence</h2>
            </div>
          </div>

          <div className="list">
            {route.stops.map((stop) => (
              <div key={stop} className="order-card">
                {stop}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <Link href="/crew/today" className="secondary-btn">
              Open crew mobile view
            </Link>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
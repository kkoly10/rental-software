import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DeliveryDetailPage() {
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
              <h2 style={{ margin: "6px 0 0" }}>Crew A Morning Route</h2>
            </div>
          </div>
          <div className="list">
            <div className="order-card">
              <strong>Assigned crew</strong>
              <div className="muted">Driver + setup technician</div>
            </div>
            <div className="order-card">
              <strong>Vehicle</strong>
              <div className="muted">Truck 1 · Trailer attached</div>
            </div>
            <div className="order-card">
              <strong>Stops</strong>
              <div className="muted">3 deliveries · 1 pickup later today</div>
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
            <div className="order-card">1. Johnson Birthday · Stafford · 9:00 AM</div>
            <div className="order-card">2. Church Event · Fredericksburg · 11:00 AM</div>
            <div className="order-card">3. School Field Day · Pickup at 4:00 PM</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Link href="/crew/today" className="secondary-btn">Open crew mobile view</Link>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

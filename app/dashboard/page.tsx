import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";

export default function DashboardPage() {
  return (
    <DashboardShell
      title="Operator Dashboard"
      description="Daily overview for bookings, deliveries, payments, and tasks."
    >
      <div className="stats-row">
        <StatCard label="Today's bookings" value="8" meta="2 awaiting deposit" />
        <StatCard label="Upcoming deliveries" value="11" meta="Next route starts 8:00 AM" />
        <StatCard label="Week revenue" value="$3,420" meta="Inflatables only" />
        <StatCard label="Balances due" value="$910" meta="3 open orders" />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Today</div>
              <h2 style={{ margin: "6px 0 0" }}>Recent orders</h2>
            </div>
          </div>
          <div className="list">
            <div className="order-card">
              <div className="order-row">
                <strong>Johnson Birthday Setup</strong>
                <StatusBadge label="Confirmed" tone="success" />
              </div>
              <div className="muted">Castle Bouncer · Delivery 9:00 AM · Stafford</div>
            </div>
            <div className="order-card">
              <div className="order-row">
                <strong>Church Spring Event</strong>
                <StatusBadge label="Awaiting Deposit" tone="warning" />
              </div>
              <div className="muted">Obstacle Course · Tentative hold · Fredericksburg</div>
            </div>
            <div className="order-card">
              <div className="order-row">
                <strong>School Field Day</strong>
                <StatusBadge label="Scheduled" />
              </div>
              <div className="muted">Water slide + add-ons · Pickup tomorrow</div>
            </div>
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Action panel</div>
              <h2 style={{ margin: "6px 0 0" }}>Tasks</h2>
            </div>
          </div>
          <div className="list">
            <div className="order-card">Confirm one unsigned waiver</div>
            <div className="order-card">Assign crew for Saturday route</div>
            <div className="order-card">Review maintenance hold on Tropical Combo</div>
            <div className="order-card">Follow up on one unpaid balance</div>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

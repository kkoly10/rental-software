import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDashboardSummary } from "@/lib/data/dashboard";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <DashboardShell
      title="Operator Dashboard"
      description="Daily overview for bookings, deliveries, payments, and tasks."
    >
      <div className="stats-row">
        <StatCard
          label="Today's bookings"
          value={String(summary.todayBookings)}
          meta="Live order pipeline"
        />
        <StatCard
          label="Upcoming deliveries"
          value={String(summary.upcomingDeliveries)}
          meta="Route-ready bookings"
        />
        <StatCard
          label="Active products"
          value={String(summary.activeProducts)}
          meta="Catalog items online"
        />
        <StatCard
          label="Payment items"
          value={String(summary.paymentItems)}
          meta="Recent money activity"
        />
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
            {summary.recentOrders.map((order) => (
              <div key={order.id} className="order-card">
                <div className="order-row">
                  <strong>{order.customer}</strong>
                  <StatusBadge
                    label={order.status}
                    tone={order.tone as "default" | "success" | "warning"}
                  />
                </div>
                <div className="muted">
                  {order.item} · {order.date} · {order.total}
                </div>
              </div>
            ))}
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
            <div className="order-card">Confirm pending waivers</div>
            <div className="order-card">Review unpaid balances</div>
            <div className="order-card">Assign delivery crews</div>
            <div className="order-card">Check maintenance queue</div>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
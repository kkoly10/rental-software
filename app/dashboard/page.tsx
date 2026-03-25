import Link from "next/link";
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
            <Link href="/dashboard/orders" className="ghost-btn">
              View all
            </Link>
          </div>

          {summary.recentOrders.length === 0 ? (
            <div className="order-card" style={{ textAlign: "center", padding: 24 }}>
              <div className="muted">No recent orders. Create one or wait for a public booking.</div>
            </div>
          ) : (
            <div className="list">
              {summary.recentOrders.map((order) => (
                <Link key={order.id} href={`/dashboard/orders/${order.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div className="order-card">
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
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Quick actions</div>
              <h2 style={{ margin: "6px 0 0" }}>Get started</h2>
            </div>
          </div>

          <div className="list">
            <Link href="/dashboard/orders/new" className="order-card" style={{ textDecoration: "none", color: "inherit" }}>
              <strong>Create new order</strong>
              <div className="muted">Manual booking, quote, or reservation</div>
            </Link>
            <Link href="/dashboard/products/new" className="order-card" style={{ textDecoration: "none", color: "inherit" }}>
              <strong>Add product</strong>
              <div className="muted">New inflatable for the public catalog</div>
            </Link>
            <Link href="/dashboard/deliveries" className="order-card" style={{ textDecoration: "none", color: "inherit" }}>
              <strong>Delivery board</strong>
              <div className="muted">Route management and crew dispatch</div>
            </Link>
            <Link href="/dashboard/payments" className="order-card" style={{ textDecoration: "none", color: "inherit" }}>
              <strong>Payment activity</strong>
              <div className="muted">Deposits, balances, and refunds</div>
            </Link>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

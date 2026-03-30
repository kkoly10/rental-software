import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/ui/stat-card";
import { getAnalytics } from "@/lib/data/analytics";

export default async function AnalyticsPage() {
  const data = await getAnalytics();

  return (
    <DashboardShell
      title="Analytics"
      description="Business performance metrics and revenue insights."
    >
      <div className="stats-row">
        <StatCard
          label="Total revenue"
          value={`$${data.totalRevenue.toLocaleString()}`}
          meta="All-time collected payments"
        />
        <StatCard
          label="Total orders"
          value={String(data.totalOrders)}
          meta={`${data.confirmedOrders} confirmed`}
        />
        <StatCard
          label="Avg order value"
          value={`$${data.averageOrderValue.toLocaleString()}`}
          meta="Per booking average"
        />
        <StatCard
          label="Conversion rate"
          value={`${data.conversionRate}%`}
          meta={`${data.cancelledOrders} cancelled`}
        />
      </div>

      <div className="stats-row" style={{ marginTop: 18 }}>
        <StatCard
          label="Total customers"
          value={String(data.totalCustomers)}
          meta="Active customer records"
        />
      </div>

      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Revenue</div>
              <h2 style={{ margin: "6px 0 0" }}>Monthly breakdown</h2>
            </div>
          </div>

          {data.revenueByMonth.length === 0 ? (
            <div className="muted" style={{ padding: 20, textAlign: "center" }}>
              No payment data yet. Revenue will appear as payments are recorded.
            </div>
          ) : (
            <div className="list">
              {data.revenueByMonth.map((m) => {
                const label = new Date(m.month + "-01T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "long", year: "numeric" }
                );
                const maxAmount = Math.max(
                  ...data.revenueByMonth.map((r) => r.amount),
                  1
                );
                const pct = Math.round((m.amount / maxAmount) * 100);

                return (
                  <div key={m.month} className="order-card">
                    <div className="order-row">
                      <strong>{label}</strong>
                      <strong>${m.amount.toLocaleString()}</strong>
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        height: 8,
                        borderRadius: 4,
                        background: "var(--surface-muted)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          borderRadius: 4,
                          background: "var(--accent)",
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside>
          <div className="panel" style={{ marginBottom: 18 }}>
            <div className="section-header">
              <div>
                <div className="kicker">Pipeline</div>
                <h2 style={{ margin: "6px 0 0" }}>Orders by status</h2>
              </div>
            </div>

            {data.ordersByStatus.length === 0 ? (
              <div className="muted">No orders yet.</div>
            ) : (
              <div className="list">
                {data.ordersByStatus.map((s) => (
                  <div key={s.status} className="order-card">
                    <div className="order-row">
                      <span>{s.status}</span>
                      <strong>{s.count}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">Catalog</div>
                <h2 style={{ margin: "6px 0 0" }}>Top products</h2>
              </div>
            </div>

            {data.topProducts.length === 0 ? (
              <div className="muted">No booking data yet.</div>
            ) : (
              <div className="list">
                {data.topProducts.map((p) => (
                  <div key={p.name} className="order-card">
                    <div className="order-row">
                      <div>
                        <strong>{p.name}</strong>
                        <div className="muted">{p.count} bookings</div>
                      </div>
                      <strong>${p.revenue.toLocaleString()}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/ui/stat-card";
import { getAnalytics } from "@/lib/data/analytics";
import { getMessages } from "@/lib/i18n/server";

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function AnalyticsPage() {
  const [data, m] = await Promise.all([getAnalytics(), getMessages()]);
  const isEmpty = data.totalOrders === 0 && data.totalCustomers === 0;

  return (
    <DashboardShell
      title={m.dashboard.analytics.title}
      description={m.dashboard.analytics.description}
    >
      {isEmpty ? (
        <section className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>{m.dashboard.analytics.emptyTitle}</h2>
          <p className="muted" style={{ maxWidth: 400, margin: "0 auto 20px" }}>
            {m.dashboard.analytics.emptyBody}
          </p>
          <a
            href="/dashboard/orders/new"
            className="ghost-btn"
            style={{ display: "inline-block" }}
          >
            {m.dashboard.analytics.createFirstOrder}
          </a>
        </section>
      ) : (
        <>
          {/* Financial metrics */}
          <div className="stats-row">
            <StatCard
              label={m.dashboard.analytics.stats.totalRevenue}
              value={formatMoney(data.totalRevenue)}
              meta="All-time collected payments"
            />
            <StatCard
              label={m.dashboard.analytics.stats.revenueThisMonth}
              value={formatMoney(data.revenueThisMonth)}
              meta="Current calendar month"
            />
            <StatCard
              label={m.dashboard.analytics.stats.outstandingBalance}
              value={formatMoney(data.outstandingBalance)}
              meta="Across active orders"
            />
            <StatCard
              label={m.dashboard.analytics.stats.avgOrderValue}
              value={formatMoney(data.averageOrderValue)}
              meta="Per paid order"
            />
          </div>

          {/* Order & conversion metrics */}
          <div className="stats-row" style={{ marginTop: 18 }}>
            <StatCard
              label={m.dashboard.analytics.stats.totalOrders}
              value={String(data.totalOrders)}
              meta={`${data.ordersThisMonth} this month · ${data.ordersThisWeek} this week`}
            />
            <StatCard
              label={m.dashboard.analytics.stats.conversionRate}
              value={`${data.conversionRate}%`}
              meta={`${data.confirmedOrders} confirmed · ${data.cancelledOrders} cancelled`}
            />
            <StatCard
              label={m.dashboard.analytics.stats.depositCollection}
              value={`${data.depositCollectionRate}%`}
              meta="Orders with deposit fulfilled"
            />
            <StatCard
              label={m.dashboard.analytics.stats.totalCustomers}
              value={String(data.totalCustomers)}
              meta={`${data.repeatCustomers} repeat · ${data.newCustomersThisMonth} new this month`}
            />
          </div>

          {/* Charts and breakdowns */}
          <div className="dashboard-grid" style={{ marginTop: 18 }}>
            <section className="panel">
              <div className="section-header">
                <div>
                  <div className="kicker">{m.dashboard.analytics.kickerRevenue}</div>
                  <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.analytics.monthlyBreakdown}</h2>
                </div>
              </div>

              {data.revenueByMonth.length === 0 ? (
                <div
                  className="muted"
                  style={{ padding: 20, textAlign: "center" }}
                >
                  No payment data yet. Revenue will appear as payments are
                  recorded.
                </div>
              ) : (
                <div className="list">
                  {data.revenueByMonth.map((m) => {
                    const label = new Date(
                      m.month + "-01T00:00:00"
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    });
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
                    <div className="kicker">{m.dashboard.analytics.kickerPipeline}</div>
                    <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.analytics.ordersByStatus}</h2>
                  </div>
                </div>

                {data.ordersByStatus.length === 0 ? (
                  <div className="muted" style={{ padding: 12 }}>
                    No orders yet.
                  </div>
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
                    <div className="kicker">{m.dashboard.analytics.kickerSchedule}</div>
                    <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.analytics.busiestDays}</h2>
                  </div>
                </div>

                {data.busiestDays.length === 0 ? (
                  <div className="muted" style={{ padding: 12 }}>
                    No event data yet.
                  </div>
                ) : (
                  <div className="list">
                    {data.busiestDays.map((d) => (
                      <div key={d.day} className="order-card">
                        <div className="order-row">
                          <span>{d.day}</span>
                          <strong>{d.count} events</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>

          {/* Top products */}
          <div style={{ marginTop: 18 }}>
            <section className="panel">
              <div className="section-header">
                <div>
                  <div className="kicker">{m.dashboard.analytics.kickerCatalog}</div>
                  <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.analytics.topProducts}</h2>
                </div>
              </div>

              {data.topProducts.length === 0 ? (
                <div className="muted" style={{ padding: 12 }}>
                  No booking data yet.
                </div>
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
            </section>
          </div>
        </>
      )}
    </DashboardShell>
  );
}

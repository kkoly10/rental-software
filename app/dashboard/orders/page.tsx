import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getOrders } from "@/lib/data/orders";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";

export default async function OrdersPage() {
  const orders = await getOrders();
  const guidanceState = await getGuidanceState();
  const helpConfig = pageHelpMap["/dashboard/orders"];

  return (
    <DashboardShell
      title="Orders"
      description="Track inquiries, confirmed bookings, payments, and delivery readiness."
    >
      {helpConfig && (
        <ContextHelpBanner config={helpConfig} dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false} />
      )}
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Rental pipeline</div>
            <h2 style={{ margin: "6px 0 0" }}>All orders</h2>
          </div>
          <Link href="/dashboard/orders/new" className="primary-btn">
            New order
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
            <strong>No orders yet</strong>
            <div className="muted" style={{ marginTop: 8 }}>
              Create your first order from the dashboard or receive one through the public booking flow.
            </div>
          </div>
        ) : (
          <div className="list">
            {orders.map((order) => (
              <Link key={order.id} href={`/dashboard/orders/${order.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <article className="order-card">
                  <div className="order-row">
                    <div>
                      <strong>{order.customer}</strong>
                      <div className="muted">{order.item}</div>
                    </div>
                    <StatusBadge
                      label={order.status}
                      tone={order.tone as "default" | "success" | "warning"}
                    />
                  </div>
                  <div className="price-row">
                    <span className="muted">{order.date}</span>
                    <strong>{order.total}</strong>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

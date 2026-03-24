import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getOrders } from "@/lib/data/orders";

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <DashboardShell
      title="Orders"
      description="Track inquiries, confirmed bookings, payments, and delivery readiness."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Rental pipeline</div>
            <h2 style={{ margin: "6px 0 0" }}>All orders</h2>
          </div>
        </div>

        <div className="list">
          {orders.map((order) => (
            <article key={order.id} className="order-card">
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

              <div style={{ marginTop: 12 }}>
                <Link href={`/dashboard/orders/${order.id}`} className="ghost-btn">
                  Open order
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
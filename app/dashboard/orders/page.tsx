import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";

const orders = [
  {
    id: "ord_1001",
    customer: "Johnson Birthday Setup",
    item: "Castle Bouncer",
    date: "May 24, 2026",
    total: "$245",
    status: "Confirmed",
    tone: "success" as const,
  },
  {
    id: "ord_1002",
    customer: "Church Spring Event",
    item: "Obstacle Course",
    date: "May 25, 2026",
    total: "$525",
    status: "Awaiting Deposit",
    tone: "warning" as const,
  },
  {
    id: "ord_1003",
    customer: "School Field Day",
    item: "Water Slide + Generator",
    date: "May 26, 2026",
    total: "$640",
    status: "Scheduled",
    tone: "default" as const,
  },
];

export default function OrdersPage() {
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
          <Link href="/dashboard/orders/ord_1001" className="secondary-btn">
            View sample detail
          </Link>
        </div>
        <div className="list">
          {orders.map((order) => (
            <article key={order.id} className="order-card">
              <div className="order-row">
                <div>
                  <strong>{order.customer}</strong>
                  <div className="muted">{order.item}</div>
                </div>
                <StatusBadge label={order.status} tone={order.tone} />
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

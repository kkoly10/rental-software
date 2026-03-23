import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mockOrders } from "@/lib/mock-data";

export default function PaymentsPage() {
  return (
    <DashboardShell
      title="Payments"
      description="Review deposits, remaining balances, and payment activity across bookings."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Money flow</div>
            <h2 style={{ margin: "6px 0 0" }}>Recent payment activity</h2>
          </div>
        </div>
        <div className="list">
          {mockOrders.map((order, index) => (
            <article key={order.id} className="order-card">
              <div className="order-row">
                <strong>{order.customer}</strong>
                <strong>{index === 0 ? "$75 deposit paid" : index === 1 ? "$0 unpaid" : "$170 due later"}</strong>
              </div>
              <div className="muted">{order.item} · {order.date}</div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}

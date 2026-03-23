import { DashboardShell } from "@/components/layout/dashboard-shell";
import { mockOrders } from "@/lib/mock-data";

export default function CustomersPage() {
  return (
    <DashboardShell
      title="Customers"
      description="View customer history, contact details, and repeat booking patterns."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Customer records</div>
            <h2 style={{ margin: "6px 0 0" }}>Recent customers</h2>
          </div>
        </div>
        <div className="list">
          {mockOrders.map((order) => (
            <article key={order.id} className="order-card">
              <strong>{order.customer}</strong>
              <div className="muted">Latest booking: {order.item}</div>
              <div className="muted">Event date: {order.date}</div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}

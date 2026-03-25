import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getOrders } from "@/lib/data/orders";

export default async function CalendarPage() {
  const orders = await getOrders();

  // Group orders by approximate day
  const upcoming = orders.slice(0, 7);

  return (
    <DashboardShell
      title="Calendar"
      description="View bookings, deliveries, and upcoming event activity by day."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Schedule view</div>
            <h2 style={{ margin: "6px 0 0" }}>Upcoming events</h2>
          </div>
          <Link href="/dashboard/orders/new" className="primary-btn">
            New booking
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
            <strong>No upcoming events</strong>
            <div className="muted" style={{ marginTop: 8 }}>
              Bookings will appear here as event dates are confirmed.
            </div>
          </div>
        ) : (
          <div className="list">
            {upcoming.map((order) => (
              <Link key={order.id} href={`/dashboard/orders/${order.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="order-card">
                  <div className="order-row">
                    <div>
                      <strong>{order.date}</strong>
                      <div className="muted">{order.customer}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong>{order.total}</strong>
                      <div className="muted">{order.status}</div>
                    </div>
                  </div>
                  <div className="muted">{order.item}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

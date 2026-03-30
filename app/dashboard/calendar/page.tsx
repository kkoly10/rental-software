import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getOrders } from "@/lib/data/orders";
import { getUpcomingBlocks } from "@/lib/availability/data";
import { BlockDatesForm } from "@/components/availability/block-dates-form";
import { AvailabilityBlockCard } from "@/components/availability/availability-block-card";

export default async function CalendarPage() {
  const [orders, blocks] = await Promise.all([
    getOrders(),
    getUpcomingBlocks(30),
  ]);

  const upcoming = orders.slice(0, 7);

  return (
    <DashboardShell
      title="Calendar"
      description="View bookings, deliveries, availability blocks, and upcoming event activity."
    >
      <div className="dashboard-grid">
        <section>
          <div className="panel">
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
          </div>
        </section>

        <aside>
          <div className="panel" style={{ marginBottom: 18 }}>
            <div className="section-header">
              <div>
                <div className="kicker">Block dates</div>
                <h2 style={{ margin: "6px 0 0" }}>Manual hold</h2>
              </div>
            </div>
            <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
              Block a product for maintenance, private events, or any reason.
            </p>
            <BlockDatesForm />
          </div>

          <div className="panel">
            <div className="section-header">
              <div>
                <div className="kicker">Next 30 days</div>
                <h2 style={{ margin: "6px 0 0" }}>
                  Availability blocks ({blocks.length})
                </h2>
              </div>
            </div>

            {blocks.length === 0 ? (
              <div className="muted">No blocked dates in the next 30 days.</div>
            ) : (
              <div className="list">
                {blocks.map((block) => (
                  <AvailabilityBlockCard key={block.id} block={block} />
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

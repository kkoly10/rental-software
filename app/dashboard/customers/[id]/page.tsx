import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCustomerDetail } from "@/lib/data/customer-detail";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomerDetail(id);

  return (
    <DashboardShell
      title="Customer Detail"
      description="View contact details, booking history, notes, and saved addresses."
    >
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Customer profile</div>
              <h2 style={{ margin: "6px 0 0" }}>{customer.name}</h2>
            </div>
          </div>

          <div className="list">
            <div className="order-card">
              <strong>Contact</strong>
              <div className="muted">
                {customer.email || "No email"} · {customer.phone || "No phone"}
              </div>
            </div>

            <div className="order-card">
              <strong>Saved address</strong>
              <div className="muted">{customer.addressLabel}</div>
            </div>

            <div className="order-card">
              <strong>Notes</strong>
              <div className="muted">{customer.notes || "No notes yet."}</div>
            </div>
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Booking history</div>
              <h2 style={{ margin: "6px 0 0" }}>Recent orders</h2>
            </div>
          </div>

          <div className="list">
            {customer.orders.map((order) => (
              <div key={order} className="order-card">
                {order}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <Link href="/dashboard/orders" className="secondary-btn">
              View all orders
            </Link>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
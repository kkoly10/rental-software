import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCustomerDetail } from "@/lib/data/customer-detail";
import { CommunicationList } from "@/components/communications/communication-list";
import { getCustomerCommunications } from "@/lib/data/communication-history";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, communications] = await Promise.all([
    getCustomerDetail(id),
    getCustomerCommunications(id),
  ]);

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
              <strong>Email</strong>
              <div className="muted">{customer.email || "No email on file"}</div>
            </div>

            <div className="order-card">
              <strong>Phone</strong>
              <div className="muted">{customer.phone || "No phone on file"}</div>
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
              <h2 style={{ margin: "6px 0 0" }}>Orders</h2>
            </div>
          </div>

          {customer.orders.length === 0 ? (
            <div className="order-card" style={{ textAlign: "center", padding: 24 }}>
              <div className="muted">No orders yet for this customer.</div>
            </div>
          ) : (
            <div className="list">
              {customer.orders.map((order, i) => (
                <div key={i} className="order-card">
                  {order}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <Link href="/dashboard/customers" className="secondary-btn">
              All customers
            </Link>
            <Link href="/dashboard/orders" className="ghost-btn">
              View orders
            </Link>
          </div>
        </aside>
      </div>

      {/* Communications history across all orders */}
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="section-header">
          <div>
            <div className="kicker">History</div>
            <h2 style={{ margin: "6px 0 0" }}>Communications</h2>
          </div>
          <span className="badge default">{communications.length}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <CommunicationList entries={communications} showOrderNumber />
        </div>
      </div>
    </DashboardShell>
  );
}

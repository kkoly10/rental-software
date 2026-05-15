import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCustomerDetail } from "@/lib/data/customer-detail";
import { CommunicationList } from "@/components/communications/communication-list";
import { getCustomerCommunications } from "@/lib/data/communication-history";
import { EditCustomerForm } from "@/components/customers/edit-customer-form";
import { getMessages } from "@/lib/i18n/server";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, communications, m] = await Promise.all([
    getCustomerDetail(id),
    getCustomerCommunications(id),
    getMessages(),
  ]);

  return (
    <DashboardShell
      title={m.dashboard.customerDetail.title}
      description={m.dashboard.customerDetail.description}
    >
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.customers.detail.kicker}</div>
              <h2 style={{ margin: "6px 0 0" }}>{customer.name}</h2>
            </div>
          </div>

          <div className="list">
            <div className="order-card">
              <strong>{m.common.email}</strong>
              <div className="muted">{customer.email || "No email on file"}</div>
            </div>

            <div className="order-card">
              <strong>{m.common.phone}</strong>
              <div className="muted">{customer.phone || "No phone on file"}</div>
            </div>

            <div className="order-card">
              <strong>{m.dashboard.customers.detail.savedAddress}</strong>
              <div className="muted">{customer.addressLabel}</div>
            </div>

            <div className="order-card">
              <strong>{m.common.notes}</strong>
              <div className="muted">{customer.notes || "No notes yet."}</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <EditCustomerForm customer={customer} />
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.customers.detail.bookingHistory}</div>
              <h2 style={{ margin: "6px 0 0" }}>Orders</h2>
            </div>
          </div>

          {customer.orders.length === 0 ? (
            <div className="order-card" style={{ textAlign: "center", padding: 24 }}>
              <div className="muted">{m.dashboard.customers.detail.noBookings}</div>
            </div>
          ) : (
            <div className="list">
              {customer.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  className="order-card"
                  style={{ display: "block", textDecoration: "none", color: "inherit" }}
                >
                  {order.label}
                </Link>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={`/dashboard/orders/new?customer_id=${id}`} className="primary-btn">
              {m.dashboard.customers.detail.newOrder}
            </Link>
            <Link href="/dashboard/customers" className="secondary-btn">
              {m.dashboard.customers.detail.allCustomers}
            </Link>
            <Link href="/dashboard/orders" className="ghost-btn">
              {m.dashboard.customers.detail.allOrders}
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

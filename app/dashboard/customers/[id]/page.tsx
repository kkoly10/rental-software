import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCustomerDetail } from "@/lib/data/customer-detail";
import { CommunicationList } from "@/components/communications/communication-list";
import { getCustomerCommunications } from "@/lib/data/communication-history";
import { EditCustomerForm } from "@/components/customers/edit-customer-form";
import { AnonymizeCustomerButton } from "@/components/customers/anonymize-customer-button";
import { WhatsAppPreferencesForm } from "@/components/customers/whatsapp-preferences-form";
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
              <div className="muted">{customer.email || m.dashboard.customers.detail.noEmail}</div>
            </div>

            <div className="order-card">
              <strong>{m.common.phone}</strong>
              <div className="muted">{customer.phone || m.dashboard.customers.detail.noPhone}</div>
            </div>

            <div className="order-card">
              <strong>{m.dashboard.customers.detail.savedAddress}</strong>
              <div className="muted">{customer.addressLabel}</div>
            </div>

            <div className="order-card">
              <strong>{m.common.notes}</strong>
              <div className="muted">{customer.notes || m.dashboard.customers.detail.noNotes}</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <EditCustomerForm customer={customer} />
          </div>

          <div
            style={{
              marginTop: 16,
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
            }}
          >
            <div className="kicker" style={{ marginBottom: 4 }}>WhatsApp</div>
            <h3 className="page-title-sm" style={{ marginTop: 4, marginBottom: 12 }}>
              Notification channel
            </h3>
            <WhatsAppPreferencesForm
              customerId={customer.id}
              defaults={{
                optedIn: customer.whatsappOptedIn,
                whatsappNumber: customer.whatsappNumber,
              }}
            />
          </div>

          <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <AnonymizeCustomerButton customerId={customer.id} customerName={customer.name} />
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.customers.detail.bookingHistory}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.customers.detail.ordersHeading}</h2>
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
            <div className="kicker">{m.dashboard.customers.detail.historyKicker}</div>
            <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.customers.detail.communicationsHeading}</h2>
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

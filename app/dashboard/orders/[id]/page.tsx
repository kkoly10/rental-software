import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getOrderDetail } from "@/lib/data/order-detail";
import { RecordPaymentForm } from "@/components/payments/record-payment-form";
import { CreateDocumentsButton } from "@/components/documents/document-actions";
import { WeatherAlert } from "@/components/weather/weather-alert";
import { CommunicationList } from "@/components/communications/communication-list";
import { getOrderCommunications } from "@/lib/data/communication-history";

function extractZip(address: string): string | undefined {
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : undefined;
}

function statusTone(status: string): "default" | "success" | "warning" {
  const lower = status.toLowerCase();
  if (lower === "confirmed" || lower === "completed" || lower === "delivered") return "success";
  if (lower.includes("awaiting") || lower.includes("quote") || lower.includes("pending")) return "warning";
  return "default";
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, communications] = await Promise.all([
    getOrderDetail(id),
    getOrderCommunications(id),
  ]);

  const hasDocuments = order.documents.length > 0 && order.documents[0] !== "No documents";

  return (
    <DashboardShell
      title="Order Detail"
      description="Single booking view for customer info, pricing, documents, and delivery readiness."
    >
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Order #{order.orderNumber}</div>
              <h2 className="page-title-sm">{order.customerName}</h2>
            </div>
            <StatusBadge label={order.status} tone={statusTone(order.status)} />
          </div>

          <div className="list">
            <div className="order-card">
              <strong>Customer</strong>
              <div className="muted">
                {order.customerName} · {order.customerEmail || "No email"} · {order.customerPhone || "No phone"}
              </div>
            </div>

            <div className="order-card">
              <strong>Event date</strong>
              <div className="muted">
                {order.eventDate}
                {order.eventStartTime && order.eventEndTime && (
                  <> · {order.eventStartTime} – {order.eventEndTime}</>
                )}
              </div>
            </div>

            <WeatherAlert
              eventDate={order.eventDate}
              zipCode={extractZip(order.deliveryLabel)}
            />

            <div className="order-card">
              <strong>Rental items</strong>
              <div className="muted">{order.items.join(" · ")}</div>
            </div>

            <div className="order-card">
              <strong>Delivery</strong>
              <div className="muted">{order.deliveryLabel}</div>
            </div>

            <div className="order-card">
              <div className="order-row">
                <strong>Documents</strong>
                {!hasDocuments && <CreateDocumentsButton orderId={id} />}
              </div>
              <div className="muted" style={{ marginTop: 4 }}>{order.documents.join(" · ")}</div>
            </div>

            {order.notes && (
              <div className="order-card">
                <strong>Notes</strong>
                <div className="muted">{order.notes}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="kicker" style={{ marginBottom: 6 }}>Record a payment</div>
            <RecordPaymentForm orderId={id} />
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Financials</div>
              <h2 className="page-title-sm">Summary</h2>
            </div>
          </div>

          <div className="list">
            <div className="order-card">
              <div className="order-row">
                <span className="muted">Subtotal</span>
                <strong>{order.subtotal}</strong>
              </div>
            </div>
            <div className="order-card">
              <div className="order-row">
                <span className="muted">Delivery fee</span>
                <strong>{order.deliveryFee}</strong>
              </div>
            </div>
            <div className="order-card">
              <div className="order-row">
                <span className="muted">Total</span>
                <strong>{order.total}</strong>
              </div>
            </div>
            <div className="order-card">
              <div className="order-row">
                <span className="muted">Deposit due</span>
                <strong>{order.depositPaid}</strong>
              </div>
            </div>
            <div className="order-card">
              <div className="order-row">
                <span className="muted">Balance due</span>
                <strong>{order.balanceDue}</strong>
              </div>
            </div>
          </div>

          <div className="action-row">
            <a
              href={`/api/invoices/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="primary-btn"
            >
              Download Invoice
            </a>
            <Link href="/dashboard/orders" className="secondary-btn">
              All orders
            </Link>
            <Link href="/dashboard/deliveries" className="ghost-btn">
              Delivery board
            </Link>
          </div>
        </aside>
      </div>

      {/* Communications audit trail */}
      <div className="panel stack-gap-sm">
        <div className="section-header">
          <div>
            <div className="kicker">Audit trail</div>
            <h2 className="page-title-sm">Communications</h2>
          </div>
          <span className="badge default">{communications.length}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <CommunicationList entries={communications} />
        </div>
      </div>
    </DashboardShell>
  );
}

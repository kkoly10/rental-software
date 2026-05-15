import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getOrderDetail } from "@/lib/data/order-detail";
import { RecordPaymentForm } from "@/components/payments/record-payment-form";
import { CreateDocumentsButton } from "@/components/documents/document-actions";
import { WeatherAlert } from "@/components/weather/weather-alert";
import { CommunicationList } from "@/components/communications/communication-list";
import { getOrderCommunications } from "@/lib/data/communication-history";
import { SendQuoteButton } from "@/components/orders/send-quote-button";
import { getMessages } from "@/lib/i18n/server";

function extractZip(address: string): string | undefined {
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : undefined;
}

function statusTone(status: string): "default" | "success" | "warning" | "danger" {
  const lower = status.toLowerCase();
  if (lower === "confirmed" || lower === "completed" || lower === "delivered") return "success";
  if (lower.includes("awaiting") || lower.includes("quote") || lower.includes("pending")) return "warning";
  if (lower === "cancelled" || lower === "refunded") return "danger";
  return "default";
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, communications, m] = await Promise.all([
    getOrderDetail(id),
    getOrderCommunications(id),
    getMessages(),
  ]);

  const hasDocuments = order.documents.length > 0 && order.documents[0] !== "No documents";

  return (
    <DashboardShell
      title={m.dashboard.orderDetail.title}
      description={m.dashboard.orderDetail.description}
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
              <strong>Delivery address</strong>
              <div className="muted">{order.deliveryLabel}</div>
              {(order.deliverySurfaceType || order.deliveryGateCode || order.deliveryContactName || order.deliverySetupNotes) && (
                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  {order.deliverySurfaceType && (
                    <div className="order-row" style={{ fontSize: 13 }}>
                      <span className="muted">Surface</span>
                      <span style={{ textTransform: "capitalize" }}>{order.deliverySurfaceType}</span>
                    </div>
                  )}
                  {order.deliveryGateCode && (
                    <div className="order-row" style={{ fontSize: 13 }}>
                      <span className="muted">Gate / access code</span>
                      <span style={{ fontFamily: "monospace" }}>{order.deliveryGateCode}</span>
                    </div>
                  )}
                  {order.deliveryContactName && (
                    <div className="order-row" style={{ fontSize: 13 }}>
                      <span className="muted">On-site contact</span>
                      <span>{order.deliveryContactName}{order.deliveryContactPhone ? ` · ${order.deliveryContactPhone}` : ""}</span>
                    </div>
                  )}
                  {order.deliverySetupNotes && (
                    <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-soft)" }}>
                      Setup notes: {order.deliverySetupNotes}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="order-card">
              <div className="order-row">
                <strong>Documents</strong>
                {!hasDocuments && <CreateDocumentsButton orderId={id} />}
              </div>
              {hasDocuments ? (
                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                  {order.documentObjects.map((doc) => (
                    <div key={doc.id} className="order-row">
                      <span className="muted" style={{ fontSize: 13 }}>
                        {doc.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        {" — "}
                        <span style={{ color: doc.status === "signed" ? "var(--success)" : undefined }}>
                          {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                        </span>
                      </span>
                      <a
                        href={`/api/documents/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: "var(--primary)" }}
                      >
                        Download PDF
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted" style={{ marginTop: 4 }}>No documents</div>
              )}
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
                <span className="muted">Deposit required</span>
                <strong>{order.depositDue ?? "—"}</strong>
              </div>
            </div>
            <div className="order-card">
              <div className="order-row">
                <span className="muted">Amount paid</span>
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
            {order.status === "Inquiry" && (
              <SendQuoteButton orderId={id} />
            )}
            {(order.status === "Quote Sent" || order.status === "Inquiry") && (
              <a
                href={`/api/quotes/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="secondary-btn"
                style={{ fontSize: 13 }}
              >
                Download Quote PDF
              </a>
            )}
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

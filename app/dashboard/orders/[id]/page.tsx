import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getOrderDetail } from "@/lib/data/order-detail";

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
  const order = await getOrderDetail(id);

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
              <h2 style={{ margin: "6px 0 0" }}>{order.customerName}</h2>
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
              <div className="muted">{order.eventDate}</div>
            </div>

            <div className="order-card">
              <strong>Rental items</strong>
              <div className="muted">{order.items.join(" · ")}</div>
            </div>

            <div className="order-card">
              <strong>Delivery</strong>
              <div className="muted">{order.deliveryLabel}</div>
            </div>

            <div className="order-card">
              <strong>Documents</strong>
              <div className="muted">{order.documents.join(" · ")}</div>
            </div>

            {order.notes && (
              <div className="order-card">
                <strong>Notes</strong>
                <div className="muted">{order.notes}</div>
              </div>
            )}
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Financials</div>
              <h2 style={{ margin: "6px 0 0" }}>Summary</h2>
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

          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/dashboard/orders" className="secondary-btn">
              All orders
            </Link>
            <Link href="/dashboard/deliveries" className="ghost-btn">
              Delivery board
            </Link>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

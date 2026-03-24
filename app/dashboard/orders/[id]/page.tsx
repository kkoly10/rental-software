import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getOrderDetail } from "@/lib/data/order-detail";

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
            <StatusBadge
              label={order.status}
              tone={
                order.status.toLowerCase() === "confirmed"
                  ? "success"
                  : order.status.toLowerCase() === "awaiting deposit"
                    ? "warning"
                    : "default"
              }
            />
          </div>

          <div className="list">
            <div className="order-card">
              <strong>Customer</strong>
              <div className="muted">
                {order.customerName} · {order.customerEmail || "No email"} ·{" "}
                {order.customerPhone || "No phone"}
              </div>
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
            <div className="order-card">Subtotal: {order.subtotal}</div>
            <div className="order-card">Delivery fee: {order.deliveryFee}</div>
            <div className="order-card">Deposit paid / due: {order.depositPaid}</div>
            <div className="order-card">Balance due: {order.balanceDue}</div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Link href="/dashboard/deliveries" className="secondary-btn">
              View delivery board
            </Link>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
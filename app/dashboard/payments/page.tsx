import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPayments } from "@/lib/data/payments";
import { getOrders } from "@/lib/data/orders";
import { RecordPaymentForm } from "@/components/payments/record-payment-form";

export default async function PaymentsPage() {
  const [payments, orders] = await Promise.all([getPayments(), getOrders()]);

  return (
    <DashboardShell
      title="Payments"
      description="Record deposits, track balances, and review payment activity."
    >
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Money flow</div>
              <h2 style={{ margin: "6px 0 0" }}>Payment activity</h2>
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
              <strong>No payment activity yet</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                Record a payment using the form on the right, or payments will appear as deposits are collected.
              </div>
            </div>
          ) : (
            <div className="list">
              {payments.map((payment) => (
                <article key={payment.id} className="order-card">
                  <div className="order-row">
                    <div>
                      <strong>{payment.customer}</strong>
                      <div className="muted">{payment.item} · {payment.date}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong>{payment.label}</strong>
                      <div style={{ marginTop: 4 }}>
                        <StatusBadge
                          label={payment.status}
                          tone={payment.status === "paid" ? "success" : payment.status === "failed" ? "warning" : "default"}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Link href="/dashboard/orders" className="ghost-btn">
              View orders for full deposit/balance breakdown
            </Link>
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Record</div>
              <h2 style={{ margin: "6px 0 0" }}>New payment</h2>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="order-card muted" style={{ textAlign: "center" }}>
              Create an order first to record payments.
            </div>
          ) : (
            <>
              <label className="order-card">
                <strong>Select order</strong>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  Choose the order this payment is for, then fill in the details below.
                </div>
              </label>
              {orders.slice(0, 5).map((order) => (
                <details key={order.id} style={{ marginBottom: 8 }}>
                  <summary className="order-card" style={{ cursor: "pointer", listStyle: "none" }}>
                    <div className="order-row">
                      <div>
                        <strong>{order.customer}</strong>
                        <div className="muted">{order.item} · {order.total}</div>
                      </div>
                      <StatusBadge label={order.status} tone={order.tone as "default" | "success" | "warning"} />
                    </div>
                  </summary>
                  <RecordPaymentForm orderId={order.id} />
                </details>
              ))}
            </>
          )}
        </aside>
      </div>
    </DashboardShell>
  );
}

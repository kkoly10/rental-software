import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPayments } from "@/lib/data/payments";

export default async function PaymentsPage() {
  const payments = await getPayments();

  return (
    <DashboardShell
      title="Payments"
      description="Review deposits, remaining balances, and payment activity across bookings."
    >
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
              Payments will appear here as deposits are collected and balances are settled.
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
      </section>

      <div style={{ marginTop: 16 }}>
        <Link href="/dashboard/orders" className="ghost-btn">
          View orders for full deposit/balance breakdown
        </Link>
      </div>
    </DashboardShell>
  );
}

import { DashboardShell } from "@/components/layout/dashboard-shell";
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
            <h2 style={{ margin: "6px 0 0" }}>Recent payment activity</h2>
          </div>
        </div>

        <div className="list">
          {payments.map((payment) => (
            <article key={payment.id} className="order-card">
              <div className="order-row">
                <strong>{payment.customer}</strong>
                <strong>{payment.label}</strong>
              </div>
              <div className="muted">
                {payment.item} · {payment.date}
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
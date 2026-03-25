import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCustomers } from "@/lib/data/customers";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <DashboardShell
      title="Customers"
      description="View customer history, contact details, and repeat booking patterns."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Customer records</div>
            <h2 style={{ margin: "6px 0 0" }}>All customers</h2>
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
            <strong>No customers yet</strong>
            <div className="muted" style={{ marginTop: 8 }}>
              Customers are created automatically when orders come in through checkout or the dashboard.
            </div>
          </div>
        ) : (
          <div className="list">
            {customers.map((customer) => (
              <Link key={customer.id} href={`/dashboard/customers/${customer.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <article className="order-card">
                  <div className="order-row">
                    <strong>{customer.name}</strong>
                    <span className="muted">{customer.latestDate}</span>
                  </div>
                  <div className="muted">{customer.email || "No email"} · {customer.phone || "No phone"}</div>
                  <div className="muted">Latest: {customer.latestBooking}</div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

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
            <h2 style={{ margin: "6px 0 0" }}>Recent customers</h2>
          </div>
        </div>

        <div className="list">
          {customers.map((customer) => (
            <article key={customer.id} className="order-card">
              <strong>{customer.name}</strong>
              <div className="muted">{customer.email || "No email on file"}</div>
              <div className="muted">{customer.phone || "No phone on file"}</div>
              <div className="muted">
                Latest booking: {customer.latestBooking} · {customer.latestDate}
              </div>
              <div style={{ marginTop: 12 }}>
                <Link
                  href={`/dashboard/customers/${customer.id}`}
                  className="ghost-btn"
                >
                  Open customer
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
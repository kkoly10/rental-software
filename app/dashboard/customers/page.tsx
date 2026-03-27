import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCustomersPage } from "@/lib/data/customers";
import { ListSearchForm } from "@/components/dashboard/list-search-form";
import { ListPagination } from "@/components/dashboard/list-pagination";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const customersPage = await getCustomersPage({
    query: params.q,
    page: params.page,
  });

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
            <div className="muted" style={{ marginTop: 8 }}>
              {customersPage.totalItems} matching customer
              {customersPage.totalItems === 1 ? "" : "s"} found
            </div>
          </div>
        </div>

        <ListSearchForm
          placeholder="Search by name, email, phone, or latest booking"
          initialQuery={customersPage.query}
        />

        {customersPage.items.length === 0 ? (
          <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
            <strong>No customers found</strong>
            <div className="muted" style={{ marginTop: 8 }}>
              {customersPage.query
                ? "Try a different search term."
                : "Customers are created automatically when orders come in through checkout or the dashboard."}
            </div>
          </div>
        ) : (
          <>
            <div className="list">
              {customersPage.items.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/dashboard/customers/${customer.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <article className="order-card">
                    <div className="order-row">
                      <strong>{customer.name}</strong>
                      <span className="muted">{customer.latestDate}</span>
                    </div>
                    <div className="muted">
                      {customer.email || "No email"} · {customer.phone || "No phone"}
                    </div>
                    <div className="muted">Latest: {customer.latestBooking}</div>
                  </article>
                </Link>
              ))}
            </div>

            <ListPagination
              pathname="/dashboard/customers"
              page={customersPage.page}
              totalPages={customersPage.totalPages}
              query={customersPage.query}
            />
          </>
        )}
      </section>
    </DashboardShell>
  );
}
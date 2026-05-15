import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getCustomersPage } from "@/lib/data/customers";
import { ListSearchForm } from "@/components/dashboard/list-search-form";
import { ListPagination } from "@/components/dashboard/list-pagination";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import { exportCustomers } from "@/lib/export/csv";
import { getTranslator } from "@/lib/i18n/server";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const [customersPage, { messages: m, t }] = await Promise.all([
    getCustomersPage({ query: params.q, page: params.page }),
    getTranslator(),
  ]);

  return (
    <DashboardShell
      title={m.dashboard.customers.title}
      description={m.dashboard.customers.description}
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">{m.dashboard.customers.kicker}</div>
            <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.customers.sectionTitle}</h2>
            <div className="muted" style={{ marginTop: 8 }}>
              {t(customersPage.totalItems === 1 ? m.dashboard.customers.matchingFound : m.dashboard.customers.matchingFoundPlural, { count: customersPage.totalItems })}
            </div>
          </div>
          <ExportCsvButton exportAction={exportCustomers} label={m.common.exportCsv} />
        </div>

        <ListSearchForm
          placeholder={m.dashboard.customers.searchPlaceholder}
          initialQuery={customersPage.query}
        />

        {customersPage.items.length === 0 ? (
          customersPage.query ? (
            <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
              <strong>{m.dashboard.customers.noCustomersFound}</strong>
              <div className="muted" style={{ marginTop: 8 }}>{m.common.tryDifferentSearch}</div>
            </div>
          ) : (
            <EmptyState
              icon="customers"
              title={m.dashboard.customers.noCustomersYet}
              description={m.dashboard.customers.noCustomersYetDescription}
              actionLabel={m.dashboard.orders.createOrder}
              actionHref="/dashboard/orders/new"
            />
          )
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
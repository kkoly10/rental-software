import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EntityRow, AvatarChip } from "@/components/ui/entity-row";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getCustomersPage } from "@/lib/data/customers";
import { ListSearchForm } from "@/components/dashboard/list-search-form";
import { ListPagination } from "@/components/dashboard/list-pagination";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import { exportCustomers } from "@/lib/export/csv";
import { getTranslator } from "@/lib/i18n/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getEmptyStateCopy } from "@/lib/verticals/empty-states";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const [customersPage, { messages: m, t }, orgCtx] = await Promise.all([
    getCustomersPage({ query: params.q, page: params.page }),
    getTranslator(),
    getOrgContext(),
  ]);
  // Phase 3c — vertical-aware empty-state copy. Falls back to the
  // generic i18n strings for legacy / unknown verticals.
  const customersEmpty = getEmptyStateCopy(orgCtx?.businessType, "customers");

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
            <div className="entity-row" style={{ justifyContent: "center", padding: 32 }}>
              <div style={{ textAlign: "center" }}>
                <strong>{m.dashboard.customers.noCustomersFound}</strong>
                <div className="muted" style={{ marginTop: 8 }}>{m.common.tryDifferentSearch}</div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon="customers"
              title={customersEmpty?.title ?? m.dashboard.customers.noCustomersYet}
              description={
                customersEmpty?.description ??
                m.dashboard.customers.noCustomersYetDescription
              }
              actionLabel={
                customersEmpty?.actionLabel ?? m.dashboard.orders.createOrder
              }
              actionHref="/dashboard/orders/new"
            />
          )
        ) : (
          <>
            <div className="list">
              {customersPage.items.map((customer) => (
                <EntityRow
                  key={customer.id}
                  href={`/dashboard/customers/${customer.id}`}
                  leading={<AvatarChip name={customer.name} />}
                  title={customer.name}
                  meta={
                    <>
                      <span style={{ display: "block" }}>
                        {customer.email || "No email"} ·{" "}
                        <span className="tnum">{customer.phone || "No phone"}</span>
                      </span>
                      <span style={{ display: "block", marginTop: 2 }}>
                        {m.dashboard.customers.latestLabel}: {customer.latestBooking}
                      </span>
                    </>
                  }
                  trailing={
                    <span className="muted" style={{ whiteSpace: "nowrap" }}>
                      {customer.latestDate}
                    </span>
                  }
                />
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

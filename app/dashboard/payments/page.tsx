import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { EntityRow, IconChip, RowFigure } from "@/components/ui/entity-row";
import { getPaymentsPage } from "@/lib/data/payments";
import { getOrders } from "@/lib/data/orders";
import { RecordPaymentForm } from "@/components/payments/record-payment-form";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";
import { ListSearchForm } from "@/components/dashboard/list-search-form";
import { ListPagination } from "@/components/dashboard/list-pagination";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import { exportPayments } from "@/lib/export/csv";
import { exportQuickBooksInvoicesCsv } from "@/lib/integrations/quickbooks/csv-export";
import { getTranslator } from "@/lib/i18n/server";

function DollarIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20" />
      <path d="M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.8 7 6.8s2 2.7 5 3.2 5 1.2 5 3.2-2.2 3.3-5 3.3-5-1.1-5-3" />
    </svg>
  );
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const [paymentsPage, orders, guidanceState, { messages: m, t }] = await Promise.all([
    getPaymentsPage({ query: params.q, page: params.page }),
    getOrders(),
    getGuidanceState(),
    getTranslator(),
  ]);
  const helpConfig = pageHelpMap["/dashboard/payments"];

  return (
    <DashboardShell
      title={m.dashboard.payments.title}
      description={m.dashboard.payments.description}
    >
      {helpConfig && (
        <ContextHelpBanner
          config={helpConfig}
          dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false}
        />
      )}
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.payments.kicker}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.payments.sectionTitle}</h2>
              <div className="muted" style={{ marginTop: 8 }}>
                {t(paymentsPage.totalItems === 1 ? m.dashboard.payments.matchingFound : m.dashboard.payments.matchingFoundPlural, { count: paymentsPage.totalItems })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ExportCsvButton exportAction={exportPayments} label={m.common.exportCsv} />
              <ExportCsvButton
                exportAction={exportQuickBooksInvoicesCsv}
                label={m.common.exportQuickBooks}
              />
            </div>
          </div>

          <ListSearchForm
            placeholder={m.dashboard.payments.searchPlaceholder}
            initialQuery={paymentsPage.query}
          />

          {paymentsPage.items.length === 0 ? (
            <div className="entity-row" style={{ justifyContent: "center", padding: 32 }}>
              <div style={{ textAlign: "center" }}>
                <strong>{m.dashboard.payments.noPaymentsFound}</strong>
                <div className="muted" style={{ marginTop: 8 }}>
                  {paymentsPage.query
                    ? m.common.tryDifferentSearch
                    : m.dashboard.payments.recordPaymentBody}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="list">
                {paymentsPage.items.map((payment) => (
                  <EntityRow
                    key={payment.id}
                    leading={
                      <IconChip
                        color={
                          payment.status === "paid"
                            ? "var(--success)"
                            : payment.status === "failed"
                            ? "var(--danger)"
                            : "var(--warning)"
                        }
                      >
                        <DollarIcon />
                      </IconChip>
                    }
                    title={payment.customer}
                    meta={
                      <span className="tnum">
                        {payment.item} · {payment.date}
                      </span>
                    }
                    trailing={
                      <>
                        <RowFigure>{payment.label}</RowFigure>
                        <StatusBadge
                          label={payment.status}
                          tone={
                            payment.status === "paid"
                              ? "success"
                              : payment.status === "failed"
                              ? "danger"
                              : "warning"
                          }
                        />
                      </>
                    }
                  />
                ))}
              </div>

              <ListPagination
                pathname="/dashboard/payments"
                page={paymentsPage.page}
                totalPages={paymentsPage.totalPages}
                query={paymentsPage.query}
              />
            </>
          )}

          <div style={{ marginTop: 16 }}>
            <Link href="/dashboard/orders" className="ghost-btn">
              {m.dashboard.payments.viewOrdersForBreakdown}
            </Link>
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.payments.recordKicker}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.payments.newPaymentTitle}</h2>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="order-card muted" style={{ textAlign: "center" }}>
              {m.dashboard.payments.createOrderFirst}
            </div>
          ) : (
            <>
              <label className="order-card">
                <strong>{m.dashboard.payments.selectOrder}</strong>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  {m.dashboard.payments.selectOrderHint}
                </div>
              </label>
              {orders.slice(0, 5).map((order) => (
                <details key={order.id} style={{ marginBottom: 8 }}>
                  <summary
                    className="order-card"
                    style={{ cursor: "pointer", listStyle: "none" }}
                  >
                    <div className="order-row">
                      <div>
                        <strong>{order.customer}</strong>
                        <div className="muted">
                          {order.item} · {order.total}
                        </div>
                      </div>
                      <StatusBadge
                        label={order.status}
                        tone={order.tone as "default" | "success" | "warning" | "danger"}
                      />
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

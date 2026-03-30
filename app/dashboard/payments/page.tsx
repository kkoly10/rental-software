import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
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

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const [paymentsPage, orders, guidanceState] = await Promise.all([
    getPaymentsPage({ query: params.q, page: params.page }),
    getOrders(),
    getGuidanceState(),
  ]);
  const helpConfig = pageHelpMap["/dashboard/payments"];

  return (
    <DashboardShell
      title="Payments"
      description="Record deposits, track balances, and review payment activity."
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
              <div className="kicker">Money flow</div>
              <h2 style={{ margin: "6px 0 0" }}>Payment activity</h2>
              <div className="muted" style={{ marginTop: 8 }}>
                {paymentsPage.totalItems} matching payment
                {paymentsPage.totalItems === 1 ? "" : "s"} found
              </div>
            </div>
            <ExportCsvButton exportAction={exportPayments} label="Export CSV" />
          </div>

          <ListSearchForm
            placeholder="Search by customer, order, type, or status"
            initialQuery={paymentsPage.query}
          />

          {paymentsPage.items.length === 0 ? (
            <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
              <strong>No payment activity found</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                {paymentsPage.query
                  ? "Try a different search term."
                  : "Record a payment using the form on the right, or payments will appear as deposits are collected."}
              </div>
            </div>
          ) : (
            <>
              <div className="list">
                {paymentsPage.items.map((payment) => (
                  <article key={payment.id} className="order-card">
                    <div className="order-row">
                      <div>
                        <strong>{payment.customer}</strong>
                        <div className="muted">
                          {payment.item} · {payment.date}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong>{payment.label}</strong>
                        <div style={{ marginTop: 4 }}>
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
                        </div>
                      </div>
                    </div>
                  </article>
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
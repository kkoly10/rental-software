import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getOrdersPage } from "@/lib/data/orders";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";
import { ListSearchForm } from "@/components/dashboard/list-search-form";
import { ListPagination } from "@/components/dashboard/list-pagination";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const [ordersPage, guidanceState] = await Promise.all([
    getOrdersPage({ query: params.q, page: params.page }),
    getGuidanceState(),
  ]);
  const helpConfig = pageHelpMap["/dashboard/orders"];

  return (
    <DashboardShell
      title="Orders"
      description="Track inquiries, confirmed bookings, payments, and delivery readiness."
    >
      {helpConfig && (
        <ContextHelpBanner
          config={helpConfig}
          dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false}
        />
      )}

      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Rental pipeline</div>
            <h2 style={{ margin: "6px 0 0" }}>All orders</h2>
            <div className="muted" style={{ marginTop: 8 }}>
              {ordersPage.totalItems} matching order
              {ordersPage.totalItems === 1 ? "" : "s"} found
            </div>
          </div>
          <Link href="/dashboard/orders/new" className="primary-btn">
            New order
          </Link>
        </div>

        <ListSearchForm
          placeholder="Search by customer, item, status, or amount"
          initialQuery={ordersPage.query}
        />

        {ordersPage.items.length === 0 ? (
          <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
            <strong>No orders found</strong>
            <div className="muted" style={{ marginTop: 8 }}>
              {ordersPage.query
                ? "Try a different search term."
                : "Create your first order from the dashboard or receive one through the public booking flow."}
            </div>
          </div>
        ) : (
          <>
            <div className="list">
              {ordersPage.items.map((order) => (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <article className="order-card">
                    <div className="order-row">
                      <div>
                        <strong>{order.customer}</strong>
                        <div className="muted">{order.item}</div>
                      </div>
                      <StatusBadge
                        label={order.status}
                        tone={order.tone as "default" | "success" | "warning" | "danger"}
                      />
                    </div>
                    <div className="price-row">
                      <span className="muted">{order.date}</span>
                      <strong>{order.total}</strong>
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            <ListPagination
              pathname="/dashboard/orders"
              page={ordersPage.page}
              totalPages={ordersPage.totalPages}
              query={ordersPage.query}
            />
          </>
        )}
      </section>
    </DashboardShell>
  );
}
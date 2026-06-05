import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { EntityRow, DateChip, RowFigure, toneColor } from "@/components/ui/entity-row";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getOrdersPage } from "@/lib/data/orders";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";
import { ListSearchForm } from "@/components/dashboard/list-search-form";
import { ListPagination } from "@/components/dashboard/list-pagination";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import { exportOrders } from "@/lib/export/csv";
import { WeatherBadge } from "@/components/weather/weather-badge";
import { FirstOrderBanner } from "@/components/orders/first-order-banner";
import { getTranslator } from "@/lib/i18n/server";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; first?: string }>;
}) {
  const params = await searchParams;
  const showFirstOrderBanner = params.first === "true";
  const [ordersPage, guidanceState, { messages: m, t }] = await Promise.all([
    getOrdersPage({ query: params.q, page: params.page }),
    getGuidanceState(),
    getTranslator(),
  ]);
  const helpConfig = pageHelpMap["/dashboard/orders"];

  return (
    <DashboardShell
      title={m.dashboard.orders.title}
      description={m.dashboard.orders.description}
    >
      {showFirstOrderBanner && <FirstOrderBanner />}

      {helpConfig && (
        <ContextHelpBanner
          config={helpConfig}
          dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false}
        />
      )}

      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">{m.dashboard.orders.kicker}</div>
            <h2 className="page-title-sm">{m.dashboard.orders.sectionTitle}</h2>
            <div className="muted" style={{ marginTop: 8 }}>
              {t(ordersPage.totalItems === 1 ? m.dashboard.orders.matchingFound : m.dashboard.orders.matchingFoundPlural, { count: ordersPage.totalItems })}
            </div>
          </div>
          <div className="action-row-inline">
            <ExportCsvButton exportAction={exportOrders} label={m.common.exportCsv} />
            <Link href="/dashboard/orders/new" className="primary-btn">
              {m.dashboard.orders.newOrder}
            </Link>
          </div>
        </div>

        <ListSearchForm
          placeholder={m.dashboard.orders.searchPlaceholder}
          initialQuery={ordersPage.query}
        />

        {ordersPage.items.length === 0 ? (
          ordersPage.query ? (
            <div className="entity-row" style={{ justifyContent: "center", padding: 32 }}>
              <div style={{ textAlign: "center" }}>
                <strong>{m.dashboard.orders.noOrdersFound}</strong>
                <div className="muted" style={{ marginTop: 8 }}>{m.common.tryDifferentSearch}</div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon="orders"
              title={m.dashboard.orders.noOrdersYet}
              description={m.dashboard.orders.noOrdersYetDescription}
              actionLabel={m.dashboard.orders.createOrder}
              actionHref="/dashboard/orders/new"
            />
          )
        ) : (
          <>
            <div className="list">
              {ordersPage.items.map((order) => (
                <EntityRow
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  accent={toneColor[order.tone]}
                  leading={<DateChip iso={order.eventDateRaw} />}
                  title={order.customer}
                  meta={
                    <>
                      <span style={{ display: "block" }}>{order.item}</span>
                      <span className="tnum" style={{ display: "block", marginTop: 2 }}>
                        {order.date}
                        {order.postalCode ? ` · ${order.postalCode}` : ""}
                      </span>
                    </>
                  }
                  trailing={
                    <>
                      {order.eventDateRaw && order.postalCode && (
                        <WeatherBadge eventDate={order.eventDateRaw} zipCode={order.postalCode} compact />
                      )}
                      <StatusBadge
                        label={order.status}
                        tone={order.tone as "default" | "success" | "warning" | "danger"}
                      />
                      <RowFigure>{order.total}</RowFigure>
                    </>
                  }
                />
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

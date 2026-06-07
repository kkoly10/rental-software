import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { EntityRow, DateChip, RowFigure, toneColor } from "@/components/ui/entity-row";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getOrdersPage, getOrderStatusCounts, ORDER_STATUS_FILTERS } from "@/lib/data/orders";
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
import { getOrgContext } from "@/lib/auth/org-context";
import { getEmptyStateCopy } from "@/lib/verticals/empty-states";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; first?: string; status?: string }>;
}) {
  const params = await searchParams;
  const showFirstOrderBanner = params.first === "true";
  const activeStatus =
    typeof params.status === "string" && params.status in ORDER_STATUS_FILTERS
      ? params.status
      : "all";

  const [ordersPage, statusCounts, guidanceState, { messages: m, t }, orgCtx] = await Promise.all([
    getOrdersPage({ query: params.q, page: params.page, status: activeStatus === "all" ? null : activeStatus }),
    getOrderStatusCounts(),
    getGuidanceState(),
    getTranslator(),
    getOrgContext(),
  ]);
  // Phase 3c — vertical-aware empty-state copy for the orders zero
  // state. Falls back to the generic i18n strings for legacy /
  // unknown verticals.
  const ordersEmpty = getEmptyStateCopy(orgCtx?.businessType, "orders");
  const helpConfig = pageHelpMap["/dashboard/orders"];
  const f = m.dashboard.orders.filters;

  const chips: { key: string; label: string; n: number }[] = [
    { key: "all", label: f.all, n: statusCounts.all },
    { key: "inquiry", label: f.inquiry, n: statusCounts.inquiry },
    { key: "confirmed", label: f.confirmed, n: statusCounts.confirmed },
    { key: "out_for_delivery", label: f.outForDelivery, n: statusCounts.out_for_delivery },
    { key: "completed", label: f.completed, n: statusCounts.completed },
  ];

  function chipHref(key: string) {
    const sp = new URLSearchParams();
    if (ordersPage.query) sp.set("q", ordersPage.query);
    if (key !== "all") sp.set("status", key);
    const qs = sp.toString();
    return `/dashboard/orders${qs ? `?${qs}` : ""}`;
  }

  return (
    <DashboardShell
      title={m.dashboard.orders.title}
      description={m.dashboard.orders.description}
      hideHeader
    >
      {showFirstOrderBanner && <FirstOrderBanner />}

      {helpConfig && (
        <ContextHelpBanner
          config={helpConfig}
          dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false}
        />
      )}

      <div className="page-hero">
        <div className="eyebrow eyebrow--accent">{m.dashboard.orders.kicker}</div>
        <div className="page-hero__row">
          <div>
            <h1 className="page-hero__title">{m.dashboard.orders.title}</h1>
            <p className="page-hero__sub">
              {t(m.dashboard.orders.pipeline, { count: statusCounts.all })}
            </p>
          </div>
          <div className="action-row-inline">
            <ExportCsvButton exportAction={exportOrders} label={m.common.exportCsv} />
            <Link href="/dashboard/orders/new" className="primary-btn">
              {m.dashboard.orders.newOrder}
            </Link>
          </div>
        </div>
      </div>

      <div className="filter-chips" style={{ marginBottom: 16 }}>
        {chips.map((c) => (
          <Link
            key={c.key}
            href={chipHref(c.key)}
            className={`filter-chip${activeStatus === c.key ? " filter-chip--active" : ""}`}
          >
            {c.label}
            <span className="filter-chip__n">{c.n}</span>
          </Link>
        ))}
      </div>

      <ListSearchForm
        placeholder={m.dashboard.orders.searchPlaceholder}
        initialQuery={ordersPage.query}
      />

      {ordersPage.items.length === 0 ? (
        ordersPage.query || activeStatus !== "all" ? (
          <div className="entity-row" style={{ justifyContent: "center", padding: 32 }}>
            <div style={{ textAlign: "center" }}>
              <strong>{m.dashboard.orders.noOrdersFound}</strong>
              <div className="muted" style={{ marginTop: 8 }}>{m.common.tryDifferentSearch}</div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon="orders"
            title={ordersEmpty?.title ?? m.dashboard.orders.noOrdersYet}
            description={
              ordersEmpty?.description ??
              m.dashboard.orders.noOrdersYetDescription
            }
            actionLabel={
              ordersEmpty?.actionLabel ?? m.dashboard.orders.createOrder
            }
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
            extraParams={activeStatus !== "all" ? { status: activeStatus } : undefined}
          />
        </>
      )}
    </DashboardShell>
  );
}

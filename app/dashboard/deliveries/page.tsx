import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDeliveryBoardData } from "@/lib/data/delivery-board";
import { getRouteDetailEnhanced } from "@/lib/data/route-detail";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";
import { DeliveryStats } from "@/components/deliveries/delivery-stats";
import { BackfillPickupButton } from "@/components/deliveries/backfill-pickup-button";
import { RouteMapWrapper } from "./route-map-wrapper";
import { CreateRouteForm } from "@/components/deliveries/create-route-form";
import { getTeamMembersForRoute } from "@/lib/data/unrouted-orders";
import { getMessages } from "@/lib/i18n/server";
import { getRoutingMode } from "@/lib/data/routing-mode";

type FulfillmentProjection = {
  booking_id: string;
  listing_title: string;
  quantity: number;
  prep_at: string;
  starts_at: string;
  ends_at: string;
  recovery_until: string;
};

/** §27 bridge inbox: marketplace bookings projected as fulfillment
 *  work. Read with the user's client (org-scoped RLS) — the operator
 *  app consumes projections, never marketplace internals. */
async function getMarketplaceFulfillment(): Promise<FulfillmentProjection[]> {
  try {
    const { hasSupabaseEnv } = await import("@/lib/env");
    if (!hasSupabaseEnv()) return [];
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("market_fulfillment_projections")
      .select("booking_id, listing_title, quantity, prep_at, starts_at, ends_at, recovery_until")
      .eq("status", "active")
      .gte("recovery_until", new Date().toISOString())
      .order("prep_at", { ascending: true })
      .limit(20);
    return (data as FulfillmentProjection[] | null) ?? [];
  } catch {
    return [];
  }
}

export default async function DeliveriesPage() {
  const [board, teamMembers, routingMode, m, marketplaceFulfillment] = await Promise.all([
    getDeliveryBoardData(),
    getTeamMembersForRoute(),
    getRoutingMode(),
    getMessages(),
    getMarketplaceFulfillment(),
  ]);
  const guidanceState = await getGuidanceState();
  const helpConfig = pageHelpMap["/dashboard/deliveries"];
  const hasAnyRoutes =
    board.assigned.length + board.inProgress.length + board.completed.length > 0;
  const enhancedRoute = board.primaryRoute
    ? await getRouteDetailEnhanced(board.primaryRoute.id)
    : null;

  return (
    <DashboardShell
      title={m.dashboard.deliveries.title}
      description={m.dashboard.deliveries.description}
    >
      {helpConfig && (
        <ContextHelpBanner config={helpConfig} dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false} />
      )}

      {marketplaceFulfillment.length > 0 ? (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="kicker">Marketplace fulfillment</div>
          <h2 className="page-title-sm" style={{ marginTop: 6 }}>
            {marketplaceFulfillment.length} marketplace booking
            {marketplaceFulfillment.length === 1 ? "" : "s"} to fulfill
          </h2>
          <div className="list" style={{ marginTop: 12 }}>
            {marketplaceFulfillment.map((f) => (
              <article key={f.booking_id} className="order-card">
                <strong>
                  {f.listing_title}
                  {f.quantity > 1 ? ` × ${f.quantity}` : ""}
                </strong>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  prep from {new Date(f.prep_at).toLocaleString()} · handoff{" "}
                  {new Date(f.starts_at).toLocaleString()} · return{" "}
                  {new Date(f.ends_at).toLocaleString()} · recovery until{" "}
                  {new Date(f.recovery_until).toLocaleString()}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Manage handoff, evidence and completion in{" "}
                  <Link href="/dashboard/marketplace">Marketplace → Seller Hub</Link>.
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {routingMode === "auto" ? (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="kicker">{m.dashboard.deliveries.autoMode.kicker}</div>
          <h2 className="page-title-sm" style={{ marginTop: 6 }}>
            {hasAnyRoutes
              ? m.dashboard.deliveries.autoMode.titleWithRoutes
              : m.dashboard.deliveries.autoMode.titleEmpty}
          </h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>
            {hasAnyRoutes
              ? m.dashboard.deliveries.autoMode.bodyWithRoutes
              : m.dashboard.deliveries.autoMode.bodyEmpty}
          </p>
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            <a href="/dashboard/settings" style={{ textDecoration: "underline" }}>
              {m.dashboard.deliveries.autoMode.manualLink}
            </a>
          </p>
        </section>
      ) : (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="kicker">{m.dashboard.deliveries.kickerDispatch}</div>
          <h2 className="page-title-sm" style={{ marginTop: 6 }}>{m.dashboard.deliveries.sectionCreateRoute}</h2>
          <CreateRouteForm teamMembers={teamMembers} />
        </section>
      )}

      <div className="delivery-board">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.deliveries.kickerOperations}</div>
              <h2 className="page-title-sm">{m.dashboard.deliveries.sectionBoard}</h2>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <BackfillPickupButton
                label={m.dashboard.deliveries.backfillPickups}
                confirm={m.dashboard.deliveries.backfillPickupsConfirm}
                runningLabel={m.dashboard.deliveries.backfillPickupsRunning}
              />
              <StatusBadge label={m.dashboard.deliveries.liveBadge} tone="success" />
            </div>
          </div>

          <div className="board-columns">
            <div className="column">
              <h3>{m.dashboard.deliveries.columns.assigned}</h3>
              <div className="list">
                {board.assigned.length ? (
                  board.assigned.map((route) => (
                    <div key={route.id} className="delivery-card">
                      <strong>{route.name}</strong>
                      <div className="muted">{route.date}</div>
                      <div className="muted">{route.stops} stops{route.driverName ? ` · ${route.driverName}` : ""}</div>
                      {route.earliestStopTime && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {route.latestStopTime
                            ? `${route.earliestStopTime} – ${route.latestStopTime}`
                            : route.earliestStopTime}
                        </div>
                      )}
                      <div className="stack-gap-xs">
                        <Link
                          href={`/dashboard/deliveries/${route.id}`}
                          className="ghost-btn"
                        >
                          {m.dashboard.deliveries.openRoute}
                        </Link>
                        <Link
                          href={`/dashboard/deliveries/${route.id}/pull-sheet`}
                          className="ghost-btn"
                        >
                          {m.dashboard.deliveries.pullSheet}
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="delivery-card">{m.dashboard.deliveries.noRoutesYet}</div>
                )}
              </div>
            </div>

            <div className="column">
              <h3>{m.dashboard.deliveries.columns.outForDelivery}</h3>
              <div className="list">
                {board.inProgress.length ? (
                  board.inProgress.map((route) => (
                    <div key={route.id} className="delivery-card">
                      <strong>{route.name}</strong>
                      <div className="muted">{route.date}</div>
                      <div className="muted">{route.stops} stops{route.driverName ? ` · ${route.driverName}` : ""}</div>
                      {route.earliestStopTime && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {route.latestStopTime
                            ? `${route.earliestStopTime} – ${route.latestStopTime}`
                            : route.earliestStopTime}
                        </div>
                      )}
                      <div className="stack-gap-xs">
                        <Link
                          href={`/dashboard/deliveries/${route.id}`}
                          className="ghost-btn"
                        >
                          {m.dashboard.deliveries.openRoute}
                        </Link>
                        <Link
                          href={`/dashboard/deliveries/${route.id}/pull-sheet`}
                          className="ghost-btn"
                        >
                          {m.dashboard.deliveries.pullSheet}
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="delivery-card">{m.dashboard.deliveries.noRoutesYet}</div>
                )}
              </div>
            </div>

            <div className="column">
              <h3>{m.dashboard.deliveries.columns.completed}</h3>
              <div className="list">
                {board.completed.length ? (
                  board.completed.map((route) => (
                    <div key={route.id} className="delivery-card">
                      <strong>{route.name}</strong>
                      <div className="muted">{route.date}</div>
                      <div className="muted">{route.stops} stops{route.driverName ? ` · ${route.driverName}` : ""}</div>
                      {route.earliestStopTime && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {route.latestStopTime
                            ? `${route.earliestStopTime} – ${route.latestStopTime}`
                            : route.earliestStopTime}
                        </div>
                      )}
                      <div className="stack-gap-xs">
                        <Link
                          href={`/dashboard/deliveries/${route.id}`}
                          className="ghost-btn"
                        >
                          {m.dashboard.deliveries.openRoute}
                        </Link>
                        <Link
                          href={`/dashboard/deliveries/${route.id}/pull-sheet`}
                          className="ghost-btn"
                        >
                          {m.dashboard.deliveries.pullSheet}
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="delivery-card">{m.dashboard.deliveries.noRoutesYet}</div>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="map-card">
          <div className="kicker">{m.dashboard.deliveries.detail.routeDetailKicker}</div>
          <h2 className="page-title-sm" style={{ marginTop: 8 }}>
            {enhancedRoute ? enhancedRoute.name : m.dashboard.deliveries.noRoutesYet}
          </h2>
          {enhancedRoute ? (
            <>
              <DeliveryStats route={enhancedRoute} />
              <RouteMapWrapper stops={enhancedRoute.stops} height="320px" />
              <div className="list" style={{ marginTop: 12 }}>
                {enhancedRoute.stops.map((stop) => (
                  <div key={stop.id} className="order-card">
                    <strong>#{stop.sequence} {stop.customerName ?? "Stop"}</strong>
                    <div className="muted">
                      {stop.scheduledTime ?? "TBD"} · {stop.type === "pickup" ? "Pickup" : "Delivery"}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="muted" style={{ marginTop: 12, fontSize: 14 }}>
              {m.dashboard.deliveries.noRoutesYetDescription}
            </div>
          )}
        </aside>
      </div>
    </DashboardShell>
  );
}

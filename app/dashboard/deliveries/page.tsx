import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDeliveryBoardData } from "@/lib/data/delivery-board";
import { getRouteDetailEnhanced } from "@/lib/data/route-detail";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";
import { DeliveryStats } from "@/components/deliveries/delivery-stats";
import { RouteMapWrapper } from "./route-map-wrapper";
import { CreateRouteForm } from "@/components/deliveries/create-route-form";
import { getTeamMembersForRoute } from "@/lib/data/unrouted-orders";
import { getMessages } from "@/lib/i18n/server";

export default async function DeliveriesPage() {
  const [board, teamMembers, m] = await Promise.all([
    getDeliveryBoardData(),
    getTeamMembersForRoute(),
    getMessages(),
  ]);
  const guidanceState = await getGuidanceState();
  const helpConfig = pageHelpMap["/dashboard/deliveries"];
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

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="kicker">{m.dashboard.deliveries.kickerDispatch}</div>
        <h2 className="page-title-sm" style={{ marginTop: 6 }}>{m.dashboard.deliveries.sectionCreateRoute}</h2>
        <CreateRouteForm teamMembers={teamMembers} />
      </section>

      <div className="delivery-board">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.deliveries.kickerOperations}</div>
              <h2 className="page-title-sm">{m.dashboard.deliveries.sectionBoard}</h2>
            </div>
            <StatusBadge label="Live" tone="success" />
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
                      <div className="stack-gap-xs">
                        <Link
                          href={`/dashboard/deliveries/${route.id}`}
                          className="ghost-btn"
                        >
                          {m.dashboard.deliveries.openRoute}
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
                      <div className="stack-gap-xs">
                        <Link
                          href={`/dashboard/deliveries/${route.id}`}
                          className="ghost-btn"
                        >
                          {m.dashboard.deliveries.openRoute}
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
                      <div className="stack-gap-xs">
                        <Link
                          href={`/dashboard/deliveries/${route.id}`}
                          className="ghost-btn"
                        >
                          {m.dashboard.deliveries.openRoute}
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

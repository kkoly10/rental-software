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

export default async function DeliveriesPage() {
  const [board, teamMembers] = await Promise.all([
    getDeliveryBoardData(),
    getTeamMembersForRoute(),
  ]);
  const guidanceState = await getGuidanceState();
  const helpConfig = pageHelpMap["/dashboard/deliveries"];
  const enhancedRoute = board.primaryRoute
    ? await getRouteDetailEnhanced(board.primaryRoute.id)
    : null;

  return (
    <DashboardShell
      title="Delivery Board"
      description="Track routes, stop status, and crew progress."
    >
      {helpConfig && (
        <ContextHelpBanner config={helpConfig} dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false} />
      )}

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="kicker">Dispatch</div>
        <h2 className="page-title-sm" style={{ marginTop: 6 }}>Create a route</h2>
        <CreateRouteForm teamMembers={teamMembers} />
      </section>

      <div className="delivery-board">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Operations</div>
              <h2 className="page-title-sm">Today&apos;s route board</h2>
            </div>
            <StatusBadge label="Live" tone="success" />
          </div>

          <div className="board-columns">
            <div className="column">
              <h3>Assigned</h3>
              <div className="list">
                {board.assigned.length ? (
                  board.assigned.map((route) => (
                    <div key={route.id} className="delivery-card">
                      <strong>{route.name}</strong>
                      <div className="muted">{route.date}</div>
                      <div className="muted">{route.stops} stops</div>
                      <div className="stack-gap-xs">
                        <Link
                          href={`/dashboard/deliveries/${route.id}`}
                          className="ghost-btn"
                        >
                          Open route
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="delivery-card">No assigned routes</div>
                )}
              </div>
            </div>

            <div className="column">
              <h3>Out for Delivery</h3>
              <div className="list">
                {board.inProgress.length ? (
                  board.inProgress.map((route) => (
                    <div key={route.id} className="delivery-card">
                      <strong>{route.name}</strong>
                      <div className="muted">{route.date}</div>
                      <div className="muted">{route.stops} stops</div>
                      <div className="stack-gap-xs">
                        <Link
                          href={`/dashboard/deliveries/${route.id}`}
                          className="ghost-btn"
                        >
                          Open route
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="delivery-card">No active routes</div>
                )}
              </div>
            </div>

            <div className="column">
              <h3>Completed</h3>
              <div className="list">
                {board.completed.length ? (
                  board.completed.map((route) => (
                    <div key={route.id} className="delivery-card">
                      <strong>{route.name}</strong>
                      <div className="muted">{route.date}</div>
                      <div className="muted">{route.stops} stops</div>
                      <div className="stack-gap-xs">
                        <Link
                          href={`/dashboard/deliveries/${route.id}`}
                          className="ghost-btn"
                        >
                          Open route
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="delivery-card">No completed routes</div>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="map-card">
          <div className="kicker">Route detail</div>
          <h2 className="page-title-sm" style={{ marginTop: 8 }}>
            {enhancedRoute ? enhancedRoute.name : "No route selected"}
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
              Create your first route above to see stop details and the map here.
            </div>
          )}
        </aside>
      </div>
    </DashboardShell>
  );
}

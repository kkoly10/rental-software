import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDeliveryBoardData } from "@/lib/data/delivery-board";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";

export default async function DeliveriesPage() {
  const board = await getDeliveryBoardData();
  const guidanceState = await getGuidanceState();
  const helpConfig = pageHelpMap["/dashboard/deliveries"];

  return (
    <DashboardShell
      title="Delivery Board"
      description="Track routes, stop status, and crew progress."
    >
      {helpConfig && (
        <ContextHelpBanner config={helpConfig} dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false} />
      )}
      <div className="delivery-board">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Operations</div>
              <h2 style={{ margin: "6px 0 0" }}>Today's route board</h2>
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
                      <div style={{ marginTop: 10 }}>
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
                      <div style={{ marginTop: 10 }}>
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
                      <div style={{ marginTop: 10 }}>
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
          <h2 style={{ marginTop: 8 }}>
            {board.primaryRoute ? board.primaryRoute.name : "No route selected"}
          </h2>
          <div className="list">
            <div className="order-card">
              {board.primaryRoute
                ? `${board.primaryRoute.date} · ${board.primaryRoute.status}`
                : "Create a route to begin dispatching"}
            </div>
            <div className="order-card">
              {board.primaryRoute
                ? `${board.primaryRoute.stops} stops on this route`
                : "Stop and crew data will appear here"}
            </div>
            <div className="order-card">
              Delivery detail pages are now linked from each route card.
            </div>
            <div className="order-card">
              Future map, proof, and signature tools go here.
            </div>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
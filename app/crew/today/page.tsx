import Link from "next/link";
import { getRoutes } from "@/lib/data/routes";
import { getRouteDetail, getRouteStops } from "@/lib/data/route-detail";
import { StopActionButtons } from "@/components/crew/stop-actions";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function CrewTodayPage() {
  const routes = await getRoutes();
  const activeRoute = routes.find((r) => r.status === "in_progress") ?? routes[0];
  const routeDetail = activeRoute ? await getRouteDetail(activeRoute.id) : null;
  const stops = activeRoute ? await getRouteStops(activeRoute.id) : [];

  return (
    <main className="page">
      <div className="container">
        <div className="mobile-frame">
          <div className="mobile-screen">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="kicker">Crew mobile</div>
              <Link href="/dashboard/deliveries" style={{ fontSize: 12, color: "var(--primary)" }}>
                Dashboard
              </Link>
            </div>
            <h1 style={{ margin: "6px 0 12px", fontSize: "1.6rem" }}>
              {routeDetail?.name ?? "Today's Stops"}
            </h1>

            {routeDetail ? (
              <>
                <div className="list">
                  <div className="mobile-card">
                    <strong>Vehicle</strong>
                    <div className="muted">{routeDetail.vehicleLabel}</div>
                  </div>
                  <div className="mobile-card">
                    <strong>Crew</strong>
                    <div className="muted">{routeDetail.crewLabel}</div>
                  </div>
                  <div className="mobile-card">
                    <strong>Summary</strong>
                    <div className="muted">{routeDetail.summaryLabel}</div>
                  </div>
                </div>

                <h2 style={{ fontSize: "1.1rem", margin: "18px 0 10px" }}>Stop sequence</h2>
                <div className="list">
                  {stops.map((stop) => (
                    <div key={stop.id} className="mobile-card">
                      <div className="order-row">
                        <div>
                          <strong>{stop.sequence}. {stop.label}</strong>
                          <div className="muted">{stop.time} · {stop.type}</div>
                        </div>
                        <StatusBadge
                          label={stop.status.replace(/_/g, " ")}
                          tone={stop.status === "completed" ? "success" : stop.status === "en_route" ? "warning" : "default"}
                        />
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <StopActionButtons stopId={stop.id} currentStatus={stop.status} />
                      </div>
                    </div>
                  ))}
                </div>

                <h2 style={{ fontSize: "1.1rem", margin: "18px 0 10px" }}>Checklist</h2>
                <div className="list">
                  <div className="mobile-card">Blower, tarp, stakes, extension cord</div>
                  <div className="mobile-card">Upload setup photo (coming soon)</div>
                  <div className="mobile-card">Collect customer signature (coming soon)</div>
                </div>
              </>
            ) : (
              <div className="list">
                <div className="mobile-card" style={{ textAlign: "center", padding: 24 }}>
                  <strong>No routes today</strong>
                  <div className="muted" style={{ marginTop: 8 }}>
                    Routes will appear here when deliveries are scheduled.
                  </div>
                </div>
              </div>
            )}

            {routes.length > 1 && (
              <>
                <h2 style={{ fontSize: "1.1rem", margin: "18px 0 10px" }}>Other routes</h2>
                <div className="list">
                  {routes.filter((r) => r.id !== activeRoute?.id).map((route) => (
                    <div key={route.id} className="mobile-card">
                      <strong>{route.name}</strong>
                      <div className="muted">{route.date} · {route.stops} stops · {route.status}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

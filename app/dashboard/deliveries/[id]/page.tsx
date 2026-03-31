import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getRouteDetailEnhanced } from "@/lib/data/route-detail";
import { DeliveryStats } from "@/components/deliveries/delivery-stats";
import { RouteDetailMapWrapper } from "./route-detail-map-wrapper";
import { RouteDetailTimeline } from "./route-detail-timeline";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const route = await getRouteDetailEnhanced(id);

  return (
    <DashboardShell
      title="Route Detail"
      description="Inspect a delivery route, crew assignment, stops, and completion state."
    >
      {/* Stats bar */}
      <DeliveryStats route={route} />

      {/* Full-width route map */}
      <div className="panel" style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
        <RouteDetailMapWrapper stops={route.stops} height="380px" />
      </div>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Route overview</div>
              <h2 style={{ margin: "6px 0 0" }}>{route.name}</h2>
            </div>
          </div>

          <div className="list">
            <div className="order-card">
              <strong>Date</strong>
              <div className="muted">{route.routeDate}</div>
            </div>

            <div className="order-card">
              <strong>Assigned crew</strong>
              <div className="muted">{route.crewLabel}</div>
            </div>

            <div className="order-card">
              <strong>Vehicle</strong>
              <div className="muted">{route.vehicleLabel}</div>
            </div>

            <div className="order-card">
              <strong>Status</strong>
              <div className="muted">
                {route.routeStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
            </div>

            <div className="order-card">
              <strong>Stops</strong>
              <div className="muted">
                {route.completedStops} of {route.totalStops} completed
              </div>
            </div>
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Stop list</div>
              <h2 style={{ margin: "6px 0 0" }}>Today&apos;s sequence</h2>
            </div>
          </div>

          <RouteDetailTimeline stops={route.stops} />

          <div style={{ marginTop: 16 }}>
            <Link href="/crew/today" className="secondary-btn">
              Open crew mobile view
            </Link>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

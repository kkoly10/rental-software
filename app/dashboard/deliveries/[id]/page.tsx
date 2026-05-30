import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getRouteDetailEnhanced } from "@/lib/data/route-detail";
import { DeliveryStats } from "@/components/deliveries/delivery-stats";
import { RouteDetailMapWrapper } from "./route-detail-map-wrapper";
import { RouteDetailTimeline } from "./route-detail-timeline";
import { RouteStatusControls, StopStatusButton, RemoveStopButton } from "@/components/deliveries/route-controls";
import { AddStopForm } from "@/components/deliveries/add-stop-form";
import { getOrdersForRouteDate } from "@/lib/data/unrouted-orders";
import { getTranslator } from "@/lib/i18n/server";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const route = await getRouteDetailEnhanced(id);
  const [ordersForDate, { messages: m, t }] = await Promise.all([
    getOrdersForRouteDate(route.routeDateRaw, id),
    getTranslator(),
  ]);

  return (
    <DashboardShell
      title={m.dashboard.routeDetail.title}
      description={m.dashboard.routeDetail.description}
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
              <div className="kicker">{m.dashboard.deliveries.detail.kicker}</div>
              <h2 style={{ margin: "6px 0 0" }}>{route.name}</h2>
            </div>
          </div>

          <div className="list">
            <div className="order-card">
              <strong>{m.dashboard.deliveries.detail.labels.date}</strong>
              <div className="muted">{route.routeDate}</div>
            </div>

            <div className="order-card">
              <strong>{m.dashboard.deliveries.detail.labels.assignedCrew}</strong>
              <div className="muted">{route.crewLabel}</div>
            </div>

            <div className="order-card">
              <strong>{m.dashboard.deliveries.detail.labels.vehicle}</strong>
              <div className="muted">{route.vehicleLabel}</div>
            </div>

            <div className="order-card">
              <strong>{m.dashboard.deliveries.detail.labels.status}</strong>
              <div className="muted" style={{ marginBottom: 10 }}>
                {route.routeStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
              <RouteStatusControls routeId={id} currentStatus={route.routeStatus} />
            </div>

            <div className="order-card">
              <strong>{m.dashboard.deliveries.detail.labels.stops}</strong>
              <div className="muted">
                {t(m.dashboard.deliveries.detail.completedOf, { done: route.completedStops, total: route.totalStops })}
              </div>
            </div>
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.deliveries.detail.sectionStops}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.deliveries.detail.sectionSequence}</h2>
            </div>
          </div>

          <div className="list" style={{ marginTop: 12 }}>
            {route.stops.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>{m.dashboard.deliveries.detail.noStops}</div>
            ) : (
              route.stops.map((stop) => (
                <div key={stop.id} className="order-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <strong>#{stop.sequence} {stop.customerName ?? m.dashboard.deliveries.detail.stopFallback}</strong>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {stop.scheduledTime ?? m.dashboard.deliveries.detail.tbd} · {stop.type === "pickup" ? m.crew.pickup : m.crew.delivery}
                    </div>
                    {stop.address && (
                      <div className="muted" style={{ fontSize: 12 }}>{stop.address}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                    <StopStatusButton
                      stopId={stop.id}
                      routeId={id}
                      orderId={stop.orderId}
                      currentStatus={stop.status ?? "assigned"}
                    />
                    {stop.status !== "completed" && (
                      <RemoveStopButton stopId={stop.id} routeId={id} />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="panel" style={{ marginTop: 16, background: "var(--primary-bg)" }}>
            <div className="kicker">{m.dashboard.deliveries.detail.addStop}</div>
            <AddStopForm
              routeId={id}
              routeDate={route.routeDateRaw}
              eligibleOrders={ordersForDate.eligible}
              blockedOrders={ordersForDate.blocked}
            />
          </div>

          {(() => {
            const addressedStops = route.stops
              .filter((s) => s.address)
              .sort((a, b) => a.sequence - b.sequence);
            if (addressedStops.length === 0) return null;
            const origin = encodeURIComponent(addressedStops[0].address!);
            const destination = encodeURIComponent(addressedStops[addressedStops.length - 1].address!);
            const mid = addressedStops.slice(1, -1).map((s) => encodeURIComponent(s.address!)).join("|");
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${origin}&destination=${destination}${mid ? `&waypoints=${mid}` : ""}`;
            return (
              <div style={{ marginTop: 16 }}>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="secondary-btn"
                  style={{ display: "inline-block" }}
                >
                  {m.dashboard.deliveries.detail.openRouteInMaps}
                </a>
              </div>
            );
          })()}

          <div style={{ marginTop: 12 }}>
            <Link href="/crew/today" className="ghost-btn">
              Open crew mobile view
            </Link>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

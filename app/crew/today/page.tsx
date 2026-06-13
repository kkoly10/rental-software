import Link from "next/link";
import { getRoutes } from "@/lib/data/routes";
import {
  getRouteDetail,
  getRouteDetailEnhanced,
  getRouteStops,
} from "@/lib/data/route-detail";
import { StopActionButtons } from "@/components/crew/stop-actions";
import { ProofPhotoUpload } from "@/components/crew/proof-photo-upload";
import { PickupPhotoUpload } from "@/components/crew/pickup-photo-upload";
import { SignaturePad } from "@/components/crew/signature-pad";
import { PickupSignaturePad } from "@/components/crew/pickup-signature-pad";
import { LocationShareButton } from "@/components/crew/location-share-button";
import { getMessages, getTranslator } from "@/lib/i18n/server";
import { RouteDetailMapWrapper } from "@/components/maps/route-detail-map-wrapper";
import { buildGoogleMapsRouteUrl } from "@/lib/maps/google-maps-route-url";

/**
 * Crew Mobile — the driver's field tool. Mobile-first, full-bleed app
 * column (the old fake phone-bezel mockup made it read as a demo on an
 * actual phone). Desktop gets the same column, centered.
 *
 * Layout priorities for a phone mounted in a truck:
 *  - progress + the CURRENT stop are the loudest things on screen
 *  - one-tap navigate per stop (Google Maps deeplink)
 *  - big tap targets for status / proof-capture actions
 *  - completed stops collapse to quiet ticks
 */
export default async function CrewTodayPage() {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const [routes, m, { t }] = await Promise.all([
    getRoutes(today),
    getMessages(),
    getTranslator(),
  ]);
  const activeRoute = routes.find((r) => r.status === "in_progress") ?? routes[0];
  // Pull both shapes for the active route: the basic detail + per-stop
  // action list (proof photos, signatures) drives the crew UI; the
  // enhanced detail has lat/lng + addresses so the map and Google Maps
  // deeplink render without a second round trip per stop.
  const [routeDetail, stops, enhancedRoute] = activeRoute
    ? await Promise.all([
        getRouteDetail(activeRoute.id),
        getRouteStops(activeRoute.id),
        getRouteDetailEnhanced(activeRoute.id),
      ])
    : [null, [], null];
  const mapsUrl = enhancedRoute
    ? buildGoogleMapsRouteUrl(enhancedRoute.stops)
    : null;

  const completedCount = stops.filter((s) => s.status === "completed").length;
  // The stop the driver should be working: first non-completed in sequence.
  const currentStopId = stops.find((s) => s.status !== "completed")?.id ?? null;

  const stopMapsLink = (address?: string | null) =>
    address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
      : null;

  return (
    <main className="crew-app">
      <header className="crew-topbar">
        <span className="crew-eyebrow">{m.crew.kicker}</span>
        <Link href="/dashboard/deliveries" className="crew-topbar-link">
          {m.crew.dashboard} →
        </Link>
      </header>

      {routeDetail ? (
        <>
          {/* ── Route header: name, meta, progress ── */}
          <section className="crew-route-head">
            <h1>{routeDetail.name}</h1>
            <div className="crew-meta">
              <span>{routeDetail.vehicleLabel}</span>
              <span>{routeDetail.crewLabel}</span>
              <span>{routeDetail.summaryLabel}</span>
            </div>
            <div className="crew-progress" aria-label={t(m.crew.stopsDone, { completed: completedCount, total: stops.length })}>
              <div className="segmented-progress">
                {stops.map((s) => (
                  <span
                    key={s.id}
                    className={`segmented-progress__seg${s.status === "completed" ? " segmented-progress__seg--on" : ""}`}
                  />
                ))}
              </div>
              <span className="crew-progress-label">
                {t(m.crew.stopsDone, { completed: completedCount, total: stops.length })}
              </span>
            </div>
          </section>

          {/* ── Map + one-tap full-route navigation ── */}
          {enhancedRoute && enhancedRoute.stops.length > 0 && (
            <section className="crew-map">
              <RouteDetailMapWrapper stops={enhancedRoute.stops} height="240px" />
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="crew-cta"
                >
                  {m.crew.openRouteInMaps}
                </a>
              )}
            </section>
          )}

          {activeRoute && (
            <section className="crew-card">
              <LocationShareButton routeId={activeRoute.id} />
            </section>
          )}

          {/* ── Stop timeline ── */}
          <h2 className="crew-section-title">{m.crew.stopSequence}</h2>
          <ol className="crew-stops">
            {stops.map((stop) => {
              const done = stop.status === "completed";
              const isCurrent = stop.id === currentStopId;
              const navUrl = stopMapsLink(stop.address);
              return (
                <li
                  key={stop.id}
                  className={`crew-stop${isCurrent ? " crew-stop--current" : ""}${done ? " crew-stop--done" : ""}`}
                >
                  <span className="crew-stop-num" aria-hidden="true">
                    {done ? "✓" : stop.sequence}
                  </span>
                  <div className="crew-stop-body">
                    <div className="crew-stop-head">
                      <strong>{stop.label}</strong>
                      <span className={`crew-stop-type crew-stop-type--${stop.type.toLowerCase()}`}>
                        {stop.type === "pickup" ? m.crew.pickup : m.crew.delivery}
                      </span>
                    </div>
                    <div className="crew-stop-meta">
                      {stop.time}
                      {stop.productName ? <> · {stop.productName}</> : null}
                    </div>
                    {stop.address && (
                      <div className="crew-stop-address">
                        {navUrl ? (
                          <a href={navUrl} target="_blank" rel="noopener noreferrer">
                            {stop.address}
                            <span className="crew-navigate">{m.crew.navigate} →</span>
                          </a>
                        ) : (
                          stop.address
                        )}
                      </div>
                    )}

                    {!done && (
                      <div className="crew-stop-actions">
                        <StopActionButtons stopId={stop.id} currentStatus={stop.status} />
                      </div>
                    )}

                    {stop.status !== "assigned" && (
                      <div className="crew-stop-capture">
                        {/* Delivery stops get the proof-of-delivery flow;
                            pickup stops get pickup capture with the
                            same-order delivery photo as a matching nudge. */}
                        {stop.type.toLowerCase() === "pickup" ? (
                          <PickupPhotoUpload
                            stopId={stop.id}
                            deliveryPhotoUrl={stop.matchingDeliveryPhotoUrl}
                            existingUrl={stop.pickupPhotoUrl}
                          />
                        ) : (
                          <ProofPhotoUpload stopId={stop.id} existingUrl={stop.proofPhotoUrl} />
                        )}
                        {stop.type.toLowerCase() === "pickup" ? (
                          !stop.pickupSignatureName ? (
                            <PickupSignaturePad stopId={stop.id} />
                          ) : (
                            <div className="crew-signed">
                              <span className="badge success">{m.crew.signed}</span>
                              {stop.pickupSignatureName}
                            </div>
                          )
                        ) : !stop.signatureName ? (
                          <SignaturePad stopId={stop.id} />
                        ) : (
                          <div className="crew-signed">
                            <span className="badge success">{m.crew.signed}</span>
                            {stop.signatureName}
                          </div>
                        )}
                      </div>
                    )}

                    {done && <div className="crew-stop-doneline">{m.crew.completedLine}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        /* ── Empty state: teach the loop instead of a dead end ── */
        <section className="crew-empty">
          <h1>{m.crew.noRoutesToday}</h1>
          <p>{m.crew.noRoutesTodayBody}</p>
          <Link href="/dashboard/deliveries" className="crew-cta">
            {m.crew.openDeliveryBoard}
          </Link>
        </section>
      )}

      {routes.length > 1 && (
        <>
          <h2 className="crew-section-title">{m.crew.otherRoutes}</h2>
          <div className="crew-other-routes">
            {routes.filter((r) => r.id !== activeRoute?.id).map((route) => (
              <div key={route.id} className="crew-card">
                <strong>{route.name}</strong>
                <div className="crew-stop-meta">
                  {route.date} · {route.stops} {m.crew.stops} · {route.status}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

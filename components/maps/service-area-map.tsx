"use client";

import { useEffect, useRef, useState } from "react";
import { geocodeZipClient } from "@/lib/maps/geocode-client";
import { escapeHtml } from "@/lib/maps/escape-html";

type ServiceArea = {
  id: string;
  label: string;
  zipCode: string;
  city?: string;
  state?: string;
  deliveryFee: number;
  minimumOrder: number;
};

type Props = {
  areas: ServiceArea[];
  interactive?: boolean;
  height?: string;
};

/* ── US center fallback ── */
const US_CENTER: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 6;

export function ServiceAreaMap({
  areas,
  interactive = false,
  height = "400px",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      let L: typeof import("leaflet");
      try {
        L = (await import("leaflet")).default as unknown as typeof import("leaflet");
      } catch {
        if (!cancelled) setMapError("Map failed to load. Please refresh the page.");
        return;
      }
      if (cancelled || !containerRef.current) return;

      /* Prevent double-init */
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        scrollWheelZoom: interactive,
        dragging: true,
        zoomControl: true,
      }).setView(US_CENTER, DEFAULT_ZOOM);

      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      /* Geocode all areas and add markers */
      const bounds: [number, number][] = [];

      for (const area of areas) {
        if (!area.zipCode) continue;
        const geo = await geocodeZipClient(area.zipCode);
        if (!geo || cancelled) continue;

        const safeLabel = escapeHtml(area.label);
        const safeZip = escapeHtml(area.zipCode);
        const locationParts = [area.city, area.state].filter(Boolean);
        const safeLocation = locationParts.length > 0
          ? escapeHtml(locationParts.join(", "))
          : "";

        const popupHtml = `
          <div class="svc-map-popup">
            <strong>${safeLabel}</strong>
            <div style="margin-top:4px;font-size:13px;color:#55708f">
              ${safeZip}${safeLocation ? ` &mdash; ${safeLocation}` : ""}
            </div>
            <div style="margin-top:6px;font-size:13px">
              Delivery fee: <strong>$${area.deliveryFee}</strong>
            </div>
            <div style="font-size:13px">
              Minimum order: <strong>$${area.minimumOrder}</strong>
            </div>
          </div>
        `;

        /* Use a divIcon circle to avoid webpack breaking Leaflet's default PNG marker paths */
        const icon = L.divIcon({
          className: "svc-area-marker-icon",
          html: `<div style="
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: var(--primary, #2563eb);
            border: 3px solid #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          "></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -18],
        });

        L.marker([geo.lat, geo.lng], { icon }).addTo(map).bindPopup(popupHtml);
        bounds.push([geo.lat, geo.lng]);
      }

      if (bounds.length > 0 && !cancelled) {
        if (bounds.length === 1) {
          map.setView(bounds[0], 11);
        } else {
          map.fitBounds(bounds, { padding: [40, 40] });
        }
      }

      /* Interactive click handler */
      if (interactive) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          const msg = `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setToast(msg);
          setTimeout(() => setToast(null), 3000);
        });
      }
    }

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [areas, interactive]);

  if (mapError) {
    return (
      <div className="svc-map-container" style={{ height, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-soft, #f8f9fa)", borderRadius: 8 }}>
        <p className="muted" style={{ textAlign: "center" }}>{mapError}</p>
      </div>
    );
  }

  return (
    <div className="svc-map-container" style={{ height }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {toast && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--text)",
            color: "var(--surface)",
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { loadLeaflet } from "@/lib/maps/load-leaflet";
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
  const mapRef = useRef<any>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      await loadLeaflet();
      if (cancelled || !containerRef.current) return;

      const L = (window as any).L;

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

        L.marker([geo.lat, geo.lng]).addTo(map).bindPopup(popupHtml);
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

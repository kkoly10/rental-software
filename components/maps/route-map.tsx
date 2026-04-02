"use client";

import { useEffect, useMemo, useRef } from "react";
import { loadLeaflet } from "@/lib/maps/load-leaflet";
import { escapeHtml } from "@/lib/maps/escape-html";

export type RouteMapStop = {
  id: string;
  sequence: number;
  type: "delivery" | "pickup";
  status: "assigned" | "en_route" | "in_progress" | "completed";
  address?: string;
  customerName?: string;
  scheduledTime?: string;
  lat?: number;
  lng?: number;
};

type Props = {
  stops: RouteMapStop[];
  showRoute?: boolean;
  interactive?: boolean;
  height?: string;
};

/* ── Status → color mapping ── */
const STATUS_COLORS: Record<string, string> = {
  assigned: "#1e5dcf",
  en_route: "#f5a623",
  in_progress: "#f5a623",
  completed: "#20b486",
};

/* ── Default center (Virginia area for demo data) ── */
const DEFAULT_CENTER: [number, number] = [38.35, -77.46];
const DEFAULT_ZOOM = 10;

export function RouteMap({
  stops,
  showRoute = true,
  interactive = true,
  height = "400px",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const geoStops = stops.filter((s) => s.lat != null && s.lng != null);

  // Stable serialization so the map re-renders when data changes, not just count
  const geoStopsKey = useMemo(() => JSON.stringify(geoStops), [geoStops]);

  useEffect(() => {
    if (geoStops.length === 0) return;

    let cancelled = false;

    async function init() {
      await loadLeaflet();
      if (cancelled || !containerRef.current) return;

      const L = (window as any).L;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        scrollWheelZoom: interactive,
        dragging: true,
        zoomControl: true,
      }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const bounds: [number, number][] = [];
      const sortedStops = [...geoStops].sort((a, b) => a.sequence - b.sequence);

      for (const stop of sortedStops) {
        const color = STATUS_COLORS[stop.status] ?? "#1e5dcf";
        const pos: [number, number] = [stop.lat!, stop.lng!];
        bounds.push(pos);

        const icon = L.divIcon({
          className: "route-marker-icon",
          html: `<div style="
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: ${color};
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
            border: 3px solid #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          ">${stop.sequence}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -18],
        });

        const typeLabel =
          stop.type === "pickup" ? "Pickup" : "Delivery";
        const statusLabel = stop.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

        const safeName = escapeHtml(stop.customerName ?? "Stop " + stop.sequence);
        const safeAddress = stop.address ? escapeHtml(stop.address) : "";
        const safeTime = stop.scheduledTime ? escapeHtml(stop.scheduledTime) : "";

        const popupHtml = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.5;min-width:160px">
            <strong style="font-size:14px">${safeName}</strong>
            ${safeAddress ? `<div style="margin-top:4px;font-size:12px;color:#55708f">${safeAddress}</div>` : ""}
            <div style="margin-top:6px;font-size:12px">
              <span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${color}22;color:${color};font-weight:600;font-size:11px">${statusLabel}</span>
              <span style="margin-left:6px;color:#55708f">${typeLabel}</span>
            </div>
            ${safeTime ? `<div style="margin-top:4px;font-size:12px;color:#55708f">Scheduled: ${safeTime}</div>` : ""}
          </div>
        `;

        L.marker(pos, { icon }).addTo(map).bindPopup(popupHtml);
      }

      /* Draw route polyline */
      if (showRoute && bounds.length > 1) {
        L.polyline(bounds, {
          color: "#1e5dcf",
          weight: 3,
          opacity: 0.6,
          dashArray: "8, 6",
        }).addTo(map);
      }

      /* Fit bounds */
      if (!cancelled && bounds.length > 0) {
        if (bounds.length === 1) {
          map.setView(bounds[0], 13);
        } else {
          map.fitBounds(bounds, { padding: [40, 40] });
        }
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
  }, [geoStopsKey, showRoute, interactive]);

  if (geoStops.length === 0) {
    return (
      <div className="route-map-container route-map-empty" style={{ height }}>
        <div className="route-map-empty-message">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-soft)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <p>Add addresses to see route on map</p>
        </div>
      </div>
    );
  }

  return (
    <div className="route-map-container" style={{ height }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

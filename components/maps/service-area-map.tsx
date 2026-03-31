"use client";

import { useEffect, useRef, useState } from "react";

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

/* ── ZIP-code → approximate lat/lng lookup (client-side, cached) ── */
const geoCache = new Map<string, { lat: number; lng: number } | null>();

async function clientGeocodeZip(
  zip: string
): Promise<{ lat: number; lng: number } | null> {
  const key = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(key)) return null;
  if (geoCache.has(key)) return geoCache.get(key) ?? null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${key}&country=US&format=json&limit=1`,
      { headers: { "User-Agent": "RentalSoftware/1.0 (service-area-map)" } }
    );
    if (!res.ok) {
      geoCache.set(key, null);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      geoCache.set(key, null);
      return null;
    }
    const result = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
    geoCache.set(key, result);
    return result;
  } catch {
    geoCache.set(key, null);
    return null;
  }
}

/* ── Leaflet CDN loader ── */
const LEAFLET_CSS =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let leafletPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<void>((resolve, reject) => {
    /* CSS */
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    /* JS */
    if ((window as any).L) {
      resolve();
      return;
    }

    if (document.querySelector(`script[src="${LEAFLET_JS}"]`)) {
      const check = setInterval(() => {
        if ((window as any).L) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Leaflet"));
    document.head.appendChild(script);
  });

  return leafletPromise;
}

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
        const geo = await clientGeocodeZip(area.zipCode);
        if (!geo || cancelled) continue;

        const location = [area.city, area.state].filter(Boolean).join(", ");

        const popupHtml = `
          <div class="svc-map-popup">
            <strong>${area.label}</strong>
            <div style="margin-top:4px;font-size:13px;color:#55708f">
              ${area.zipCode}${location ? ` &mdash; ${location}` : ""}
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

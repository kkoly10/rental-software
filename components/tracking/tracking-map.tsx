"use client";

import { useEffect, useRef, useState } from "react";
import { loadLeaflet } from "@/lib/maps/load-leaflet";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface DriverPosition {
  lat: number;
  lng: number;
  accuracy_m?: number;
}

interface Props {
  routeId: string;
  isLive: boolean;
  initialStatus: string;
}

export function TrackingMap({ routeId, isLive, initialStatus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [position, setPosition] = useState<DriverPosition | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "offline">("connecting");
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    let cancelled = false;
    async function initMap() {
      await loadLeaflet();
      if (cancelled || !containerRef.current || mapRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L;
      const map = L.map(containerRef.current, { scrollWheelZoom: true, zoomControl: true })
        .setView([38.9, -77.0], 10);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);
    }
    initMap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isLive) { setConnectionState("offline"); return; }
    (async () => {
      const { data } = await supabase
        .from("driver_locations")
        .select("lat, lng, accuracy_m")
        .eq("route_id", routeId)
        .maybeSingle();
      if (data) setPosition({ lat: data.lat, lng: data.lng, accuracy_m: data.accuracy_m ?? undefined });
      setConnectionState("live");
    })();
  }, [routeId, isLive]);

  useEffect(() => {
    if (!isLive) return;
    const channel = supabase
      .channel(`driver-location:${routeId}`)
      .on("broadcast", { event: "location_update" }, (msg: { payload: DriverPosition }) => {
        setPosition(msg.payload);
        setConnectionState("live");
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnectionState("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnectionState("offline");
      });

    // Flag stale if no broadcast for 45s
    const staleTimer = setInterval(() => setConnectionState("offline"), 45_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(staleTimer);
    };
  }, [routeId, isLive]);

  useEffect(() => {
    if (!position || !mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L) return;
    const latlng: [number, number] = [position.lat, position.lng];

    const icon = L.divIcon({
      className: "driver-marker",
      html: `<div style="width:38px;height:38px;border-radius:50%;background:#f5a623;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:20px">🚛</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    if (!markerRef.current) {
      markerRef.current = L.marker(latlng, { icon }).addTo(mapRef.current);
      mapRef.current.setView(latlng, 14, { animate: true });
    } else {
      markerRef.current.setLatLng(latlng);
      if (!mapRef.current.getBounds().contains(latlng)) {
        mapRef.current.panTo(latlng, { animate: true, duration: 0.5 });
      }
    }
  }, [position]);

  const statusMsg =
    initialStatus === "completed"
      ? "Delivered!"
      : connectionState === "live"
      ? "Driver location is live"
      : connectionState === "offline"
      ? "Waiting for location update…"
      : "Connecting…";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
      <div ref={containerRef} style={{ flex: 1, minHeight: 400 }} />
      <div style={{
        position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
        background: "white", borderRadius: 20, padding: "8px 16px",
        boxShadow: "0 2px 12px rgba(0,0,0,.15)", fontSize: 13,
        display: "flex", alignItems: "center", gap: 8, zIndex: 1000,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", display: "inline-block",
          background: connectionState === "live" ? "#20b486" : "#f5a623",
        }} />
        {statusMsg}
      </div>
    </div>
  );
}

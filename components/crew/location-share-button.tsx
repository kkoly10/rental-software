"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

const PUBLISH_INTERVAL_MS = 20_000;

export function LocationShareButton({ routeId }: { routeId: string }) {
  const { messages } = useI18n();
  const t = messages.forms.crew.locationShare;
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createSupabaseBrowserClient>["channel"]> | null>(null);
  const lastPublishRef = useRef<number>(0);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function startSharing() {
    if (!("geolocation" in navigator)) {
      setError(t.geolocationUnsupported);
      return;
    }

    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await (navigator as unknown as { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
      } catch { /* not fatal */ }
    }

    channelRef.current = supabase.channel(`driver-location:${routeId}`);
    channelRef.current.subscribe();

    setSharing(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        if (now - lastPublishRef.current < PUBLISH_INTERVAL_MS) return;
        lastPublishRef.current = now;

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        await supabase.from("driver_locations").upsert(
          { route_id: routeId, lat, lng, accuracy_m: accuracy, updated_at: new Date().toISOString() },
          { onConflict: "route_id" }
        );

        channelRef.current?.send({
          type: "broadcast",
          event: "location_update",
          payload: { lat, lng, accuracy_m: accuracy, ts: new Date().toISOString() },
        });

        setLastUpdate(new Date().toLocaleTimeString());
      },
      (posErr) => {
        if (posErr.code === 1) {
          setError(t.permissionDenied);
          stopSharing();
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 }
    );
  }

  function stopSharing() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setSharing(false);
    setLastUpdate(null);
  }

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === "visible" && sharing && "wakeLock" in navigator && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await (navigator as unknown as { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
        } catch { /* ignore */ }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [sharing]);

  useEffect(() => () => stopSharing(), []);

  return (
    <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--surface-2, #f5f5f5)", borderRadius: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-soft)" }}>
        {t.title}
      </div>
      {!sharing ? (
        <button className="primary-btn" onClick={startSharing} style={{ fontSize: 12, padding: "6px 14px" }}>
          {t.shareMyLocation}
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#20b486", display: "inline-block" }} />
            <span style={{ fontSize: 13 }}>{t.sharingLocation}</span>
          </div>
          {lastUpdate && (
            <div style={{ fontSize: 11, color: "var(--text-soft)" }}>{formatMessage(t.lastSent, { time: lastUpdate })}</div>
          )}
          <button onClick={stopSharing} className="ghost-btn" style={{ fontSize: 12, padding: "4px 10px", marginTop: 4, width: "fit-content" }}>
            {t.stopSharing}
          </button>
        </div>
      )}
      {error && (
        <div style={{ color: "var(--danger, #e53e3e)", fontSize: 12, marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}

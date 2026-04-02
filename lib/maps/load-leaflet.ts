/**
 * Shared Leaflet CDN loader — singleton, used by both RouteMap and ServiceAreaMap.
 */

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

const MAX_POLL_ATTEMPTS = 100; // 100 × 50ms = 5 seconds max

let leafletPromise: Promise<void> | null = null;

export function loadLeaflet(): Promise<void> {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<void>((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    if ((window as any).L) {
      resolve();
      return;
    }

    if (document.querySelector(`script[src="${LEAFLET_JS}"]`)) {
      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        if ((window as any).L) {
          clearInterval(check);
          resolve();
        } else if (attempts >= MAX_POLL_ATTEMPTS) {
          clearInterval(check);
          console.error("Leaflet CDN: timed out waiting for window.L");
          reject(new Error("Leaflet load timeout"));
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

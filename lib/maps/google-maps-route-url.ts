/**
 * Build a Google Maps "Directions" deeplink for an ordered list of
 * stops. Returns null when there's nothing addressed to navigate to.
 *
 * - 1 addressed stop  → single destination, no origin (Maps uses the
 *   user's current location)
 * - 2+ addressed stops → origin = first, destination = last, the rest
 *   become waypoints in sequence order
 *
 * Used by both the dispatcher route detail page and the crew mobile
 * view so they stay in lock-step. Stops without an address are dropped
 * — the assumption is the driver can navigate around them.
 */
export type GoogleMapsRouteStop = {
  sequence: number;
  address?: string | null;
};

export function buildGoogleMapsRouteUrl(
  stops: GoogleMapsRouteStop[],
): string | null {
  const addressed = stops
    .filter((s): s is { sequence: number; address: string } =>
      typeof s.address === "string" && s.address.trim().length > 0,
    )
    .sort((a, b) => a.sequence - b.sequence);

  if (addressed.length === 0) return null;

  const base = "https://www.google.com/maps/dir/?api=1&travelmode=driving";

  if (addressed.length === 1) {
    return `${base}&destination=${encodeURIComponent(addressed[0].address)}`;
  }

  const origin = encodeURIComponent(addressed[0].address);
  const destination = encodeURIComponent(addressed[addressed.length - 1].address);
  const mid = addressed
    .slice(1, -1)
    .map((s) => encodeURIComponent(s.address))
    .join("|");

  return `${base}&origin=${origin}&destination=${destination}${mid ? `&waypoints=${mid}` : ""}`;
}

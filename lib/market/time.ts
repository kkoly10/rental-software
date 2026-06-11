/**
 * Marketplace time handling — single source of truth.
 *
 * Bug #18/#37 fix: the marketplace operates in one business timezone
 * (the DMV launch metro). Parsing "2026-06-15" + a fixed hour with
 * `new Date("...T09:00:00")` resolves in the SERVER's zone (UTC on
 * Vercel), shifting every renter's calendar day. We pin all booking
 * window construction and date display to America/New_York so the
 * stored window, the future-date check, rental-day math, and rendered
 * dates all agree with what a DMV renter sees.
 */

export const MARKET_TZ = "America/New_York";

/**
 * The UTC offset (in minutes, e.g. -240 for EDT) for the marketplace
 * timezone at a given instant. Derived from Intl so DST is handled
 * without a date library.
 */
function tzOffsetMinutes(at: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUTC - at.getTime()) / 60_000;
}

/**
 * Build a UTC Date for a wall-clock "YYYY-MM-DD" + hour:minute in the
 * marketplace timezone. e.g. ("2026-06-15", 9, 0) → the instant that
 * is 9:00 AM in New York on that date, DST-correct.
 */
export function marketWallClock(
  dateYmd: string,
  hour: number,
  minute = 0,
): Date {
  const [y, m, d] = dateYmd.split("-").map(Number);
  // First approximation assuming UTC, then correct by the zone offset
  // at that approximate instant (good enough away from the DST seam;
  // the marketplace pins hours to 09:00/18:00, never near 02:00).
  const approx = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, hour, minute));
  const offset = tzOffsetMinutes(approx, MARKET_TZ);
  return new Date(approx.getTime() - offset * 60_000);
}

/** Render a stored timestamp as a date in the marketplace timezone. */
export function formatMarketDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

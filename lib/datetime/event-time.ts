/**
 * Timezone-aware date/time helpers for event display + cron arithmetic.
 *
 * The codebase has historically mixed three different time models:
 *   (a) wall-clock-treated-as-UTC: `${eventDate}T${startTime}:00.000Z`
 *   (b) server-local: `new Date(...)` + `.toLocaleTimeString("en-US")` with no `timeZone`
 *   (c) UTC arithmetic: `.toISOString().slice(0, 10)`
 *
 * (a) and (b) are wrong when the org's customers, the operator, and the
 * server are not all in UTC. This module centralises the safe primitives:
 *
 *   - formatTimeInTimeZone:  render a UTC ISO timestamp as a human time
 *                            string in the org's IANA timezone.
 *   - addDaysUtc:            DST-safe day arithmetic (no setDate footgun).
 *   - dateOnlyUtc:           "YYYY-MM-DD" of a Date, always in UTC.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Format a date (Date object or ISO string) as a clock time in a specific
 * timezone. Returns e.g. "2:30 PM" or "14:30" depending on the locale.
 *
 * Callers MUST pass the org's IANA TZ — passing undefined falls back to
 * "UTC" instead of the server's local TZ, so behavior is consistent
 * across regions/Vercel deploys.
 */
export function formatTimeInTimeZone(
  date: Date | string,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const tz = timeZone && timeZone.length > 0 ? timeZone : "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: tz }).format(d);
  } catch {
    // Invalid IANA name — fall back to UTC rather than silently using server local.
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(d);
  }
}

/**
 * Format a date as a calendar day in a specific timezone.
 */
export function formatDateInTimeZone(
  date: Date | string,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const tz = timeZone && timeZone.length > 0 ? timeZone : "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: tz }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(d);
  }
}

/**
 * Add (or subtract) whole calendar days using UTC arithmetic so DST
 * transitions don't skip / repeat a day. The legacy pattern is
 * `d.setDate(d.getDate() + 1)` which uses local-time arithmetic and
 * silently produces an "ambiguous" timestamp on the spring-forward day.
 */
export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Return the YYYY-MM-DD string of a Date in UTC. Equivalent to
 * `d.toISOString().slice(0, 10)` but safer against future Intl drift.
 */
export function dateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * "Today" as a UTC date string.
 */
export function todayUtc(): string {
  return dateOnlyUtc(new Date());
}

/**
 * "Tomorrow" as a UTC date string. DST-safe — always exactly 24h ahead.
 */
export function tomorrowUtc(): string {
  return dateOnlyUtc(addDaysUtc(new Date(), 1));
}

/**
 * N days ago as a UTC date string.
 */
export function daysAgoUtc(days: number): string {
  return dateOnlyUtc(addDaysUtc(new Date(), -Math.abs(days)));
}

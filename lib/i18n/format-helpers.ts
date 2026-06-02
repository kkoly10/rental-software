import type { Locale } from "./config";

/**
 * Format a monetary amount for display. Uses Intl.NumberFormat with the
 * caller's locale and ISO currency code. Intl knows about zero-decimal
 * currencies (JPY, KRW, VND, etc.) and renders the symbol + grouping in
 * the locale-appropriate position.
 */
export function formatMoney(
  amount: number,
  currency: string = "USD",
  locale: Locale | string = "en"
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    // Fall back to a USD-shaped string if the currency code is unknown.
    return `$${amount.toFixed(2)}`;
  }
}

/**
 * Format an event date stored as a YYYY-MM-DD string. The date is anchored
 * to noon UTC so it renders as the same calendar day in every timezone
 * (sidestepping the midnight-UTC-rolls-back-a-day bug).
 */
export function formatEventDate(
  dateStr: string,
  locale: Locale | string = "en",
  options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }
): string {
  if (!dateStr) return "";
  try {
    const d = new Date(`${dateStr}T12:00:00Z`);
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Format an absolute timestamp (ISO string or Date) for display.
 */
export function formatTimestamp(
  input: string | Date,
  locale: Locale | string = "en",
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }
): string {
  if (!input) return "";
  try {
    const d = typeof input === "string" ? new Date(input) : input;
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch {
    return "";
  }
}

/**
 * Return today's date as a YYYY-MM-DD string anchored to the browser's
 * local timezone. Replaces the pattern `new Date().toLocaleDateString("en-CA")`,
 * which works in Chrome but produces non-ISO output in Safari/Firefox under
 * some non-en-CA system locales.
 */
export function toLocalISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

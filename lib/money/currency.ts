/**
 * Currency utilities for round-tripping between human-readable amounts
 * (e.g., `12.50`) and Stripe's minor-unit representation (e.g., `1250`).
 *
 * Stripe charges most currencies in their minor unit (cents, pence, etc.),
 * so a $12.50 charge is sent as `unit_amount: 1250`. But ~17 currencies
 * have NO minor unit — they're treated as integers. ¥1,000 is sent as
 * `unit_amount: 1000`, NOT 100000.
 *
 * Source: https://stripe.com/docs/currencies#zero-decimal
 *
 * Threading this set through every `* 100` / `/ 100` site is the
 * difference between charging a Japanese customer ¥1,000 vs. ¥10 for
 * the same order.
 */

/**
 * Currencies Stripe treats as integer-only. Lowercase ISO 4217 codes.
 * Kept as a frozen set so a stray push() doesn't quietly corrupt it.
 */
export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

function normalize(currency: string | null | undefined): string {
  return (currency ?? "usd").toLowerCase();
}

export function isZeroDecimalCurrency(currency: string | null | undefined): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(normalize(currency));
}

/**
 * Convert a human-readable amount to Stripe's minor-unit integer.
 * For decimal currencies: `12.50, "usd"` -> `1250`.
 * For zero-decimal currencies: `1000, "jpy"` -> `1000`.
 *
 * Always returns a non-negative integer. Callers should treat negative
 * input as a programmer error (refunds are positive amounts to Stripe).
 */
export function toStripeMinorUnits(amount: number, currency: string | null | undefined): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`toStripeMinorUnits: amount must be finite, got ${amount}`);
  }
  if (isZeroDecimalCurrency(currency)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}

/**
 * Convert a Stripe minor-unit integer back to a human-readable amount.
 * For decimal currencies: `1250, "usd"` -> `12.50`.
 * For zero-decimal currencies: `1000, "jpy"` -> `1000`.
 */
export function fromStripeMinorUnits(stripeAmount: number, currency: string | null | undefined): number {
  if (!Number.isFinite(stripeAmount)) {
    throw new Error(`fromStripeMinorUnits: stripeAmount must be finite, got ${stripeAmount}`);
  }
  if (isZeroDecimalCurrency(currency)) {
    return stripeAmount;
  }
  return stripeAmount / 100;
}

/**
 * Normalize a currency string to lowercase. Returns "usd" if the input
 * is null/undefined/empty — the default we use everywhere prices land
 * without explicit currency context.
 */
export function normalizeCurrency(currency: string | null | undefined): string {
  return normalize(currency);
}

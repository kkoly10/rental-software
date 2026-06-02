import type { PricingRule, PricingCalculation } from "./types";

export function calculatePrice(
  basePrice: number,
  rules: PricingRule[],
  context: {
    eventDate: string;
    bookingDate?: string;
    rentalDays?: number;
    productId?: string;
    pricingModel?: string; // 'flat_day' | 'per_day' | 'hourly'
  }
): PricingCalculation {
  // Per-day pricing: multiply base price by rental duration before applying rules.
  if (context.pricingModel === "per_day" && (context.rentalDays ?? 1) > 1) {
    const days = context.rentalDays ?? 1;
    const perDayResult = calculatePrice(
      basePrice * days,
      rules,
      { ...context, pricingModel: "flat_day", rentalDays: days }
    );
    return { ...perDayResult, rentalDays: days };
  }
  const activeRules = rules
    .filter((r) => r.isActive)
    // Primary sort: priority desc. Secondary tiebreaker on the rule
    // name to give two rules with identical priority a deterministic
    // order across all JS engines (V8/Spidermonkey both implement
    // stable sort now, but that didn't help across engines that
    // returned rules in different DB orders).
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

  // Anchor both dates to UTC midnight so the day-difference math doesn't
  // depend on the server's local TZ. The previous version used
  // `new Date(date + "T00:00:00")` (local) and `new Date(year, month, day)`
  // (local) which produced different daysUntilEvent values on servers
  // in different timezones — early-bird/last-minute pricing rules then
  // applied differently depending on which Vercel region answered the
  // request.
  const eventDateObj = new Date(context.eventDate + "T00:00:00Z");
  const bookingDateObj = context.bookingDate
    ? new Date(context.bookingDate + "T00:00:00Z")
    : (() => {
        const n = new Date();
        return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
      })();

  // Both operands are at UTC midnight, so the difference is whole days.
  const daysUntilEvent = Math.round(
    (eventDateObj.getTime() - bookingDateObj.getTime()) / (1000 * 60 * 60 * 24)
  );

  const adjustments: PricingCalculation["adjustments"] = [];

  // Accumulate rule adjustments in cents-integers, round only at the
  // output boundary. The previous loop rounded each rule independently
  // via Math.round(basePrice * pct * 100)/100 then summed; that could
  // accumulate up to ~0.5¢ per rule on a multi-rule order. Keeping
  // the running total in integer cents eliminates the drift.
  const basePriceCents = Math.round(basePrice * 100);
  let totalAdjustmentCents = 0;

  for (const rule of activeRules) {
    if (!matchesRule(rule, eventDateObj, daysUntilEvent, context)) continue;

    const ruleAdjustmentCents = Math.round(basePriceCents * (rule.adjustment / 100));
    totalAdjustmentCents += ruleAdjustmentCents;
    adjustments.push({
      ruleName: rule.name,
      amount: ruleAdjustmentCents / 100,
      percentage: rule.adjustment,
    });
  }

  const totalAdjustment = totalAdjustmentCents / 100;
  const finalCents = Math.max(0, basePriceCents + totalAdjustmentCents);
  const finalPrice = finalCents / 100;

  return { basePrice, adjustments, finalPrice };
}

// Cheap date-format guard so a malformed rule like
// `{ start: "2026-13-01", end: "..." }` doesn't silently accept events.
// Validating at the rule edit form would be cleaner; this is the
// engine-side safety net.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidIsoDate(s: string | null | undefined): s is string {
  if (!s || !ISO_DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function matchesRule(
  rule: PricingRule,
  eventDate: Date,
  daysUntilEvent: number,
  context: { rentalDays?: number; productId?: string }
): boolean {
  const { conditions } = rule;

  switch (rule.type) {
    case "weekend": {
      const dow = eventDate.getDay();
      const targetDays = conditions.daysOfWeek ?? [0, 6];
      return targetDays.includes(dow);
    }

    case "holiday":
    case "peak_season": {
      if (!conditions.dateRanges || conditions.dateRanges.length === 0) return false;
      const eventStr = formatDateLocal(eventDate);
      // Reject malformed date ranges (e.g. "2026-13-01" from a
      // misedit) instead of treating them as matchable strings.
      // String compare against a garbage value would silently
      // produce arbitrary truth values.
      return conditions.dateRanges.some(
        (range) =>
          isValidIsoDate(range.start) &&
          isValidIsoDate(range.end) &&
          range.start <= range.end &&
          eventStr >= range.start &&
          eventStr <= range.end
      );
    }

    case "early_bird": {
      const min = conditions.daysBeforeEvent?.min ?? 14;
      return daysUntilEvent >= min;
    }

    case "last_minute": {
      const max = conditions.daysBeforeEvent?.max ?? 3;
      return daysUntilEvent >= 0 && daysUntilEvent <= max;
    }

    case "multi_day": {
      const minDays = conditions.minRentalDays ?? 3;
      return (context.rentalDays ?? 1) >= minDays;
    }

    case "bundle": {
      if (!conditions.productIds || conditions.productIds.length === 0) return false;
      return context.productId
        ? conditions.productIds.includes(context.productId)
        : false;
    }

    default:
      return false;
  }
}

function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

import type { PricingRule, PricingCalculation } from "./types";

export function calculatePrice(
  basePrice: number,
  rules: PricingRule[],
  context: {
    eventDate: string;
    bookingDate?: string;
    rentalDays?: number;
    productId?: string;
  }
): PricingCalculation {
  const activeRules = rules
    .filter((r) => r.isActive)
    .sort((a, b) => b.priority - a.priority);

  const eventDateObj = new Date(context.eventDate + "T00:00:00");
  const bookingDateObj = context.bookingDate
    ? new Date(context.bookingDate + "T00:00:00")
    : new Date();

  const daysUntilEvent = Math.floor(
    (eventDateObj.getTime() - bookingDateObj.getTime()) / (1000 * 60 * 60 * 24)
  );

  const adjustments: PricingCalculation["adjustments"] = [];

  for (const rule of activeRules) {
    if (!matchesRule(rule, eventDateObj, daysUntilEvent, context)) continue;

    const amount = Math.round(basePrice * (rule.adjustment / 100) * 100) / 100;
    adjustments.push({
      ruleName: rule.name,
      amount,
      percentage: rule.adjustment,
    });
  }

  const totalAdjustment = adjustments.reduce((sum, a) => sum + a.amount, 0);
  const finalPrice = Math.max(0, Math.round((basePrice + totalAdjustment) * 100) / 100);

  return { basePrice, adjustments, finalPrice };
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
      return conditions.dateRanges.some(
        (range) => eventStr >= range.start && eventStr <= range.end
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

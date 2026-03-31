export type PricingRuleType =
  | "weekend"
  | "holiday"
  | "peak_season"
  | "early_bird"
  | "last_minute"
  | "multi_day"
  | "bundle";

export type PricingRule = {
  id: string;
  name: string;
  type: PricingRuleType;
  adjustment: number; // percentage: positive = surcharge, negative = discount
  conditions: {
    daysOfWeek?: number[]; // 0=Sun, 6=Sat for weekend
    dateRanges?: { start: string; end: string }[]; // for seasonal
    daysBeforeEvent?: { min?: number; max?: number }; // early bird / last minute
    minRentalDays?: number; // multi-day discount
    productIds?: string[]; // bundle specific products
  };
  isActive: boolean;
  priority: number; // higher = applied first
};

export type PricingCalculation = {
  basePrice: number;
  adjustments: { ruleName: string; amount: number; percentage: number }[];
  finalPrice: number;
};

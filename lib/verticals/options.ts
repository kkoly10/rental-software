import { listVerticals } from "./registry.ts";

/**
 * Shape consumed by the signup + onboarding vertical pickers. Built
 * server-side from the registry so neither surface can drift from the
 * verticals the app actually supports.
 */
export type VerticalOption = {
  value: string;
  label: string;
  /** Short preview of the seeded categories. */
  description: string;
  /** One-line summary of the cancellation + lead-time policy this pick locks in. */
  policySummary: string;
};

/**
 * Build the vertical picker options from the registry. Each card
 * previews the seeded categories and the cancellation/lead-time policy
 * the pick locks in — making the choice visibly consequential rather
 * than cosmetic.
 */
export function buildVerticalOptions(): VerticalOption[] {
  return listVerticals().map((v) => {
    const { refundWindowDays, forfeitPct, minLeadTimeHours } = v.policies;
    const lead =
      minLeadTimeHours >= 48
        ? `${Math.round(minLeadTimeHours / 24)}-day min lead`
        : `${minLeadTimeHours}h min lead`;
    const refund =
      forfeitPct === 0
        ? "Always fully refundable"
        : `${forfeitPct}% deposit forfeit within ${refundWindowDays} days`;
    return {
      value: v.slug,
      label: v.label.en,
      description: v.defaultCategorySeeds.slice(0, 4).join(" · "),
      policySummary: `${refund} · ${lead}`,
    };
  });
}

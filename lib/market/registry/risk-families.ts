import type { OperatingDefaults, RiskFamily } from "./types.ts";

/**
 * Risk families — the policy backbone (spec §5, §6, §9, §14).
 *
 * Every category maps to exactly one family; the family supplies the
 * full set of operating defaults so a category override is always a
 * refinement, never a requirement. Deposit %/floors come from spec §9
 * (clamp precedence: the used-value cap ALWAYS beats the floor — that
 * rule lives in the deposit engine, not here). Buffers come from §14.
 * Target daily pricing bands come from §8 and are pre-benchmark
 * defaults, to be corrected by the benchmark library where retail
 * anchors disagree.
 */

const base: OperatingDefaults = {
  instantBookAllowed: false,
  depositStrategy: "auth_hold",
  depositPct: 15,
  depositFloorCents: 5_000,
  proofOfFunctionRequired: false,
  sanitationClass: "none",
  identityVerification: "payment_method",
  deliveryAllowed: true,
  disputeSensitivity: "low",
  minBookingSubtotalCents: 1_500,
  accessoriesChecklistRequired: false,
  serialNumberRequired: false,
  prepBufferMinutes: 60,
  recoveryBufferMinutes: 60,
  targetDailyPctOfReplacement: 4,
};

function family(
  slug: RiskFamily["slug"],
  label: string,
  overrides: Partial<OperatingDefaults>,
): RiskFamily {
  return { slug, label, defaults: { ...base, ...overrides } };
}

export const riskFamilies: readonly RiskFamily[] = [
  family("passive-standard", "Passive standard", {
    instantBookAllowed: true,
  }),

  family("furniture-standard", "Furniture standard", {
    instantBookAllowed: true,
    depositPct: 20,
    depositFloorCents: 7_500,
    prepBufferMinutes: 120,
    recoveryBufferMinutes: 240,
    targetDailyPctOfReplacement: 5.5,
  }),

  family("powered-standard", "Powered standard", {
    depositPct: 25,
    depositFloorCents: 10_000,
    proofOfFunctionRequired: true,
    prepBufferMinutes: 120,
    recoveryBufferMinutes: 720,
    disputeSensitivity: "medium",
    targetDailyPctOfReplacement: 10,
  }),

  family("electronics-standard", "Electronics standard", {
    depositPct: 25,
    depositFloorCents: 10_000,
    proofOfFunctionRequired: true,
    accessoriesChecklistRequired: true,
    prepBufferMinutes: 60,
    recoveryBufferMinutes: 240,
    disputeSensitivity: "medium",
    targetDailyPctOfReplacement: 6.5,
  }),

  family("high-value-electronics", "High-value electronics", {
    depositPct: 35,
    depositFloorCents: 25_000,
    proofOfFunctionRequired: true,
    accessoriesChecklistRequired: true,
    serialNumberRequired: true,
    identityVerification: "full_id",
    prepBufferMinutes: 120,
    recoveryBufferMinutes: 1_440,
    disputeSensitivity: "high",
    minBookingSubtotalCents: 3_000,
    targetDailyPctOfReplacement: 4,
  }),

  family("towable-road", "Towable / road", {
    depositPct: 40,
    depositFloorCents: 30_000,
    serialNumberRequired: true,
    identityVerification: "full_id",
    deliveryAllowed: false,
    prepBufferMinutes: 240,
    recoveryBufferMinutes: 1_440,
    disputeSensitivity: "high",
    minBookingSubtotalCents: 3_000,
    accessoriesChecklistRequired: true,
    // §8 reality check: U-Haul anchors commodity trailers far below
    // 3.5% of replacement; the benchmark library wins over this band.
    targetDailyPctOfReplacement: 3.5,
  }),

  family("baby-sensitive", "Baby sensitive", {
    depositPct: 20,
    depositFloorCents: 7_500,
    sanitationClass: "strict",
    prepBufferMinutes: 240,
    recoveryBufferMinutes: 1_440,
    disputeSensitivity: "medium",
    targetDailyPctOfReplacement: 5,
  }),

  family("food-contact", "Food contact", {
    depositPct: 20,
    depositFloorCents: 7_500,
    sanitationClass: "strict",
    proofOfFunctionRequired: true,
    prepBufferMinutes: 240,
    recoveryBufferMinutes: 1_440,
    disputeSensitivity: "medium",
    targetDailyPctOfReplacement: 6.5,
  }),

  family("restoration-and-emergency", "Restoration & emergency", {
    depositPct: 30,
    depositFloorCents: 15_000,
    proofOfFunctionRequired: true,
    instantBookAllowed: true,
    prepBufferMinutes: 60,
    recoveryBufferMinutes: 720,
    disputeSensitivity: "medium",
    targetDailyPctOfReplacement: 12,
  }),

  family("multi-component-event", "Multi-component event", {
    depositPct: 25,
    depositFloorCents: 15_000,
    accessoriesChecklistRequired: true,
    prepBufferMinutes: 360,
    recoveryBufferMinutes: 1_440,
    disputeSensitivity: "medium",
    minBookingSubtotalCents: 5_000,
    targetDailyPctOfReplacement: 7.5,
  }),

  family("manual-review-restricted", "Manual review / restricted", {
    depositStrategy: "manual_review",
    depositPct: 50,
    depositFloorCents: 50_000,
    proofOfFunctionRequired: true,
    serialNumberRequired: true,
    identityVerification: "full_id",
    instantBookAllowed: false,
    disputeSensitivity: "high",
    minBookingSubtotalCents: 5_000,
    prepBufferMinutes: 1_440,
    recoveryBufferMinutes: 1_440,
    targetDailyPctOfReplacement: 6,
  }),
];

export const riskFamilyBySlug: ReadonlyMap<string, RiskFamily> = new Map(
  riskFamilies.map((f) => [f.slug, f] as const),
);

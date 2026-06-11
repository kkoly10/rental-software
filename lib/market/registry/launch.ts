import type { Metro } from "./types.ts";

/**
 * Launch configuration (spec §31).
 *
 * Decisions recorded 2026-06-11:
 *  - Marketplace host: rent.korent.app (subdomain of the app domain,
 *    reserved in middleware ahead of tenant-slug resolution).
 *  - Launch metro #1: Washington–DMV (founder-led seller onboarding).
 *
 * Worlds graduate from smoke_test to live per-metro when the §31
 * gates are met; gates are configuration, not code.
 */

export const metros: readonly Metro[] = [
  { slug: "dmv", label: "Washington–DMV", state: "DC/MD/VA" },
];

export const DEFAULT_METRO_SLUG = "dmv";

export const metroBySlug: ReadonlyMap<string, Metro> = new Map(
  metros.map((m) => [m.slug, m] as const),
);

/**
 * Graduation gate defaults (spec §31) — evaluated against
 * market_demand_events + pre-listings per world per metro. Tunable
 * with real data; do not hard-code elsewhere.
 */
export const graduationGates = {
  minSellerPrelistings: 25,
  minRenterSearches: 200,
  minWaitlistJoins: 75,
  windowDays: 60,
} as const;

/**
 * Hostnames/slug labels the marketplace owns. The middleware treats
 * any subdomain of NEXT_PUBLIC_APP_DOMAIN as an operator-storefront
 * tenant; these labels are reserved so no org can ever claim them.
 */
export const RESERVED_MARKETPLACE_SUBDOMAINS = ["rent", "market", "marketplace"] as const;

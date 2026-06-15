import type { VerticalConfig } from "./types.ts";

/**
 * Other / general rentals — the catch-all an operator picks at signup
 * when their business doesn't match one of the marketed verticals.
 *
 * This is a SETUP-ONLY vertical (`setupOnly: true`): it appears in the
 * signup + onboarding pickers so a generalist can complete onboarding,
 * but it is excluded from every marketing surface (no /[vertical]
 * landing page, no sitemap entry, no footer / sibling links). There's
 * no SEO value in a generic "general rental software" page, and it
 * would dilute the vertical-specific pages that rank.
 *
 * Competitor recon (Booqable, Quipli, EZRentOut, Alert Rental): the
 * market leaders are general-purpose and explicitly recognize
 * "general rental" / "general tool rental" as a first-class catch-all,
 * starting operators with a flexible, rename-able catalog rather than
 * forcing niche categories. We mirror that: neutral starter categories,
 * the broadly-applicable capabilities (flat-day pricing, structured
 * specs, add-ons, damage waiver), and a lenient default cancellation
 * policy.
 *
 * The `marketing` and `imageSlugs` blocks below satisfy the
 * VerticalConfig type but are never rendered — the registry's marketing
 * helpers skip `setupOnly` verticals.
 */
export const otherVertical: VerticalConfig = {
  slug: "other",
  setupOnly: true,
  // Neutral middle-of-the-road money defaults — a generalist tunes these
  // in Settings. 30% deposit, $100 order minimum, $50 round-trip delivery.
  operatorDefaults: { depositPercentage: 30, orderMinimum: 100, deliveryFee: 50 },
  label: {
    en: "Other / general rentals",
    es: "Otro / alquileres generales",
    fr: "Autre / location générale",
    pt: "Outro / aluguer geral",
  },
  // The broadly-applicable subset: a daily flat rate (the most common
  // general-rental model), a structured spec list, optional add-ons, and
  // a damage waiver. Nothing vertical-specific (no anchoring, wet/dry,
  // surface type, capacity calc, or onsite attendant).
  capabilities: [
    "pricing.flat-day",
    "display.structured-specs",
    "composition.add-ons",
    "order.damage-waiver",
  ],
  // Lenient general default: fully refundable until 2 days out, no
  // vertical lead-time floor (the org's own policy governs).
  policies: {
    refundWindowDays: 2,
    forfeitPct: 0,
    minLeadTimeHours: 0,
  },
  // Neutral, rename-friendly starters. Kept in sync with the
  // bootstrap_organization "other" branch (migration
  // 20260613_050000) so signup and add-vertical seed the same buckets.
  defaultCategorySeeds: ["Featured Items", "Equipment", "Accessories", "Add-Ons"],
  // Inert — filtered from all marketing surfaces by `setupOnly`.
  marketing: {
    landingPageSlug: "general-rental-software",
    seoTitle: "General Rental Software | Korent",
    seoDescription:
      "Run any rental business on Korent — flexible catalog, online bookings, delivery scheduling, and payments.",
    heroKicker: "Rental software",
    heroHeadline: "Run your rental business online.",
    heroSubhead:
      "A flexible catalog, online bookings, delivery scheduling, and payments — for any kind of rental.",
    features: [
      { title: "Flexible catalog", body: "Start with general categories and rename them to match your inventory." },
      { title: "Online bookings", body: "Take reservations and deposits online with a branded storefront." },
      { title: "Delivery scheduling", body: "Route and schedule deliveries and pickups from one board." },
      { title: "Payments built in", body: "Collect deposits and balances with Stripe — no separate processor." },
    ],
  },
  imageSlugs: {
    hero: "/storefront-defaults/hero/tables-and-chairs.jpg",
  },
  storefrontDefaults: {
    heroImagePath: "/storefront-defaults/hero/tables-and-chairs.jpg",
    headlineLead: "Rent what you need,",
    headlineItalic: "when you need it.",
    lede: "Browse the catalog and reserve online across {area} — pickup or delivery, your choice.",
    taglineLabel: "Rentals",
    trustBadges: [
      { kicker: "Reliable", statement: "Clean, ready-to-use items and on-time pickup or delivery across {area}." },
      { kicker: "Clear pricing", statement: "What you see is what you pay — no surprise fees at checkout." },
      { kicker: "Easy booking", statement: "Reserve online and pay your deposit in a few minutes." },
    ],
    vibeTiles: [
      { kicker: "Most booked", label: "Featured", imagePath: "/storefront-defaults/hero/tables-and-chairs.jpg", href: "/inventory" },
      { kicker: "For the job", label: "Equipment", imagePath: "/storefront-defaults/hero/concessions.jpg", href: "/inventory" },
      { kicker: "See it all", label: "Browse all", imagePath: "/storefront-defaults/hero/inflatable.jpg", href: "/inventory" },
    ],
  },
};

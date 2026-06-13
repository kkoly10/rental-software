import type { VerticalConfig } from "./types.ts";

/**
 * Concessions — popcorn, snow cone, cotton candy, hot dog, frozen
 * drink. Sold per-hour with "1 hour included, +$100/hr after" as the
 * industry baseline. Servings counts are the customer-facing trust
 * signal ("makes 40 snow cones per 20lb ice bag"). Bundles cleanly
 * with inflatable rentals — same operator, same checkout, same crew.
 *
 * Pricing recon (2026):
 *   - "1 hour included, +$100/hr after" for full-service is the
 *     standard offering.
 *   - Standard 110V power.
 *   - Consumables included by operator (popcorn kernels, syrup, ice).
 *   - Servings counts vary by machine — surface on the PDP via
 *     structured-specs.
 *   - Common combo packages (popcorn + cotton candy + snow cone).
 */
export const concessionsVertical: VerticalConfig = {
  slug: "concessions",
  operatorDefaults: { depositPercentage: 30, orderMinimum: 150, deliveryFee: 75 },
  label: {
    en: "Concessions",
    es: "Concesiones",
    fr: "Concessions",
    pt: "Concessões",
  },
  capabilities: [
    "pricing.per-hour",
    "service.onsite-attendant",
    "display.structured-specs",
    "display.capacity-calculator",
    "composition.add-ons",
  ],
  /**
   * Machines re-rent but consumables are pre-ordered — full
   * refund until 7 days out; 48h notice for supplies.
   */
  policies: {
    refundWindowDays: 7,
    forfeitPct: 0,
    minLeadTimeHours: 48,
  },
  defaultCategorySeeds: [
    "Popcorn Machine",
    "Snow Cone Machine",
    "Cotton Candy Machine",
    "Hot Dog Roller",
    "Frozen Drink Machine",
  ],
  marketing: {
    landingPageSlug: "concession-rental-software",
    seoTitle:
      "Concession Equipment Rental Software (Popcorn, Snow Cone) | Korent",
    seoDescription:
      "Per-hour pricing with first-hour-included attendant, servings-per-rental on structured PDP specs, and combo-package add-ons — built for concession equipment rental businesses.",
    heroKicker: "Concession rental software",
    heroHeadline:
      "Pop the popcorn, scoop the snow cones. Take concession equipment bookings online with per-hour pricing.",
    heroSubhead:
      "Customers see servings yield, power requirements, and the 1-hour-attendant-included pricing right on the listing. Combo packages (popcorn + cotton candy + snow cone) land as one order with three child line items.",
    features: [
      {
        title: "Per-hour with first hour included",
        body: "Operator sets included attendant hours = 1 and overage rate = $100/hr; the helper computes overage at submit and writes attendant_overage_hours to the line item for refund / dispute lookups.",
      },
      {
        title: "Servings yield on the PDP",
        body: "Capacity calculator's `servings` metric ('Makes about 200 snow cones per rental') is the customer-facing trust signal. Operator sets it once; storefront shows it forever.",
      },
      {
        title: "Structured specs row",
        body: "Power (110V / 20A standard), footprint, weight, consumables included — definition list rendered in the operator's display order so the customer can pre-check their venue.",
      },
      {
        title: "Cleaning fee + consumables as add-ons",
        body: "Composition.add-ons lets the operator surface 'Extra Bag of Kernels' or 'Cleaning Fee' as optional/required add-ons. Customer toggles, child order_items lines link via parent_order_item_id.",
      },
      {
        title: "Bundles with inflatables",
        body: "Concession-only operators are rare. The dashboard supports multi-vertical orgs — declare both concessions + inflatables and your storefront / categories / nav adapt automatically.",
      },
    ],
  },
  imageSlugs: {
    hero: "/marketing/concessions/operators-popcorn-cart-tablet.jpg",
    crew: "/marketing/concessions/restocking-cotton-candy-truck.jpg",
    transitionBanner: "/marketing/concessions/vintage-concession-carts-trio.jpg",
  },
  storefrontDefaults: {
    heroImagePath: "/storefront-defaults/hero/concessions.jpg",
    headlineLead: "Popcorn, cotton candy, and shaved ice",
    headlineItalic: "for the crowd.",
    lede: "Cart rentals delivered, stocked, and attended across {area}. Choose self-serve or staffed; both with proper food-handling permits in place.",
    taglineLabel: "Party rentals",
    trustBadges: [
      { kicker: "Permitted", statement: "Local food-handling permits maintained for every staffed event we run." },
      { kicker: "Stocked", statement: "Carts arrive pre-stocked for your guest count — no last-minute supply runs." },
      { kicker: "On time", statement: "Setup completed at least 30 minutes before doors across {area}." },
    ],
    vibeTiles: [
      { kicker: "For the school", label: "Field-day events", imagePath: "/storefront-defaults/hero/concessions.jpg", href: "/inventory?vibe=school" },
      { kicker: "For the brand", label: "Activations", imagePath: "/storefront-defaults/hero/photo-booths.jpg", href: "/inventory?vibe=corporate" },
      { kicker: "For the celebration", label: "Backyard parties", imagePath: "/storefront-defaults/hero/inflatable.jpg", href: "/inventory?vibe=parties" },
    ],
  },
};

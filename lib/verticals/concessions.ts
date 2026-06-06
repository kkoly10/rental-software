import type { VerticalConfig } from "./types.ts";

/**
 * Concessions — popcorn, snow cone, cotton candy, hot dog, pizza,
 * frozen drink machines. Almost every inflatable operator already
 * carries these as add-ons, so this vertical is heavily bundled
 * with existing customers' carts. Slot 5 / final vertical in the
 * design doc's day-one set.
 *
 * Pricing model: per-hour with a 1-hour minimum. Industry standard
 * per Freedom FUN USA / 702Jump / Bounce Universe 2026 listings —
 * "1 hour included, +$100/hr after" for full-service. Drop-off
 * service is a flat-day option, but the per-hour attendant model
 * is the common upsell.
 *
 * Power + consumables + servings-per-unit all live as structured
 * specs on the PDP. Consumables (popcorn kernels, syrup, ice) are
 * typically included by the operator; servings counts ("makes 40
 * snow cones per 20lb ice bag") are the customer-facing trust signal.
 */
export const concessionsVertical: VerticalConfig = {
  slug: "concessions",
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
    "composition.add-ons",
  ],
  defaultCategorySeeds: [
    "Popcorn Machine",
    "Snow Cone Machine",
    "Cotton Candy Machine",
    "Hot Dog Steamer",
    "Frozen Drink Machine",
  ],
  marketing: {
    landingPageSlug: "concession-rental-software",
    seoTitle:
      "Concession Rental Software for Popcorn, Snow Cone & Cotton Candy | Korent",
    seoDescription:
      "Per-hour pricing, attendant scheduling, power/consumables specs, and cleaning-fee add-ons — built for popcorn, snow cone, cotton candy, and frozen drink machine rental businesses.",
    heroKicker: "Concession rental software",
    heroHeadline:
      "Snow cones, popcorn, cotton candy — booked online with the attendant time included.",
    heroSubhead:
      "Customers pick a machine, see \"makes 40 servings per 20lb ice\" on the PDP, and reserve a 2-hour rental with 1 attendant hour included. Power requirements and consumables list right above the Add to Cart button.",
    features: [
      {
        title: "Per-hour pricing with 1-hour minimum",
        body: "Customer picks N hours; storefront shows \"1 hour included + $100/hr after\". Math is automatic; attendant overage flows to the pull sheet.",
      },
      {
        title: "Structured PDP specs",
        body: "Power (110V / 15A), footprint, prints per cycle, servings per consumable bag — operator enters once, every PDP renders the same definition list. No prose-blob descriptions.",
      },
      {
        title: "Attendant included for the first hour",
        body: "Your attendant sets up the machine, gets it running, and trains the customer. Overage hours auto-bill at the rate you set. No haggling at pickup.",
      },
      {
        title: "Cleaning fee + extra consumables as add-ons",
        body: "Cotton candy sugar? Snow cone syrup? Cleaning surcharge? Composition.add-ons surfaces each as a checkbox at checkout. Customer ticks; you collect.",
      },
      {
        title: "Bundles cleanly with inflatables",
        body: "Same operator, same checkout, same crew. The bounce-house customer adds a popcorn machine to the cart and you ship both on one delivery.",
      },
    ],
  },
  imageSlugs: {
    hero: "/home/operator-with-ipad.jpg",
    crew: "/home/crew-loading-trailer.jpg",
    inventory: "/home/inventory-warehouse.jpg",
  },
};

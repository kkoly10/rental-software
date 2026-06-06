import type { VerticalConfig } from "./types.ts";

/**
 * Photo booths — open-air booths, enclosed booths, 360° booths,
 * mirror booths. Fastest-growing segment in the party umbrella
 * (~11% CAGR per the 2026 IBISWorld / Check Cherry / Snappic data)
 * and the slot 4 vertical from the design doc.
 *
 * Pricing model: per-hour with a 3-hour minimum (industry standard
 * per Kande / Captured Celebrations / Premier Rentals 2026 pricing
 * guides). $200/hr base, $150/hr additional. Onsite attendant
 * typically included for the entire rental.
 *
 * The variant-gallery capability is the single biggest 10/10 unlock
 * here — photo-booth operators define themselves by their backdrop
 * catalog, and a visual picker on the PDP is what Check Cherry and
 * Snappic both ship. Without it, the operator would have to list
 * each backdrop as a separate SKU.
 */
export const photoBoothsVertical: VerticalConfig = {
  slug: "photo-booths",
  label: {
    en: "Photo booths",
    es: "Photo booths",
    fr: "Photobooths",
    pt: "Photo booths",
  },
  capabilities: [
    "pricing.per-hour",
    "setup.setup-window",
    "service.onsite-attendant",
    "display.variant-gallery",
    "display.structured-specs",
    "composition.add-ons",
  ],
  defaultCategorySeeds: [
    "Open-Air Photo Booth",
    "Enclosed Photo Booth",
    "360° Video Booth",
    "Mirror Photo Booth",
    "Selfie Pod",
  ],
  marketing: {
    landingPageSlug: "photo-booth-rental-software",
    seoTitle:
      "Photo Booth Rental Software with Backdrop Picker & Hourly Pricing | Korent",
    seoDescription:
      "Per-hour pricing with a 3-hour minimum, visual backdrop picker, attendant scheduling, and extra-hour add-ons — built for open-air, enclosed, and 360° photo booth rental businesses.",
    heroKicker: "Photo booth rental software",
    heroHeadline:
      "Take 3-hour bookings online. Backdrop picker, attendant included, extra hours one click.",
    heroSubhead:
      "Customers click through your backdrop catalog (sequin gold, tropical leaf, Roman stripe), pick a 3-hour package, and add overage hours at checkout. Your attendant gets a pull sheet with the booth, backdrop pick, and arrival time.",
    features: [
      {
        title: "Per-hour pricing with a 3-hour minimum",
        body: "Storefront shows the package + per-hour overage rate. Math is clean: 4 hours at $200/hr = $800. Below the minimum bills the minimum, never $0.",
      },
      {
        title: "Visual backdrop picker on the PDP",
        body: "Variant gallery shows clickable thumbnails of every backdrop with optional price deltas. Premium sequin? +$25. Custom step-and-repeat? +$300. Customer picks; you skip the email thread.",
      },
      {
        title: "Attendant scheduling on the pull sheet",
        body: "1 attendant per booth, arrival time = event start − 60 min. The crew app shows which booth + backdrop and how many guests to expect.",
      },
      {
        title: "Extra hours as a checkout add-on",
        body: "Composition.add-ons surfaces \"add 1 more hour\" as a checkbox at +$150. No quote thread, no manual invoice.",
      },
      {
        title: "Equipment specs in a clean PDP table",
        body: "Power requirements, footprint, prints-per-hour, optional GIFs / boomerang / green screen — structured-specs makes the table render itself from operator-entered key/value pairs.",
      },
      {
        title: "Built for solo operators scaling to a small team",
        body: "Start with one booth on weekends. Add part-time attendants with crew-only access (they see today's stops, not your payments). Grow to 5 booths without changing the workflow.",
      },
    ],
  },
  imageSlugs: {
    hero: "/home/operator-with-ipad.jpg",
    crew: "/home/crew-loading-trailer.jpg",
    inventory: "/home/inventory-warehouse.jpg",
  },
};

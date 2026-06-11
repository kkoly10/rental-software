import type { VerticalConfig } from "./types.ts";

/**
 * Tents & canopies — frame tents, pole tents, sailcloth, canopies,
 * and the sidewall / lighting / heating accessory tail. Highest
 * overlap with existing inflatable operators (most party-rental
 * shops carry both) so this is the recommended #2 vertical to
 * promote on the homepage.
 *
 * Pricing model: flat-day. Each tent size + style is its own SKU;
 * sidewalls / lighting / heating land as composition.add-ons rows
 * pointing at their own products.
 *
 * Images: placeholder paths under /verticals/tents/ until real
 * assets land. The inflatable hero image lives at /home/operator-
 * with-ipad.jpg and is reused below as a temporary fallback so the
 * page renders without 404'd <Image> calls; swap when assets ship.
 */
export const tentsVertical: VerticalConfig = {
  slug: "tents",
  label: {
    en: "Tents",
    es: "Carpas",
    fr: "Tentes",
    pt: "Tendas",
  },
  capabilities: [
    "pricing.flat-day",
    "setup.anchoring",
    "setup.surface-type",
    "setup.setup-window",
    "display.capacity-calculator",
    "display.structured-specs",
    "display.variant-gallery",
    "composition.add-ons",
    "order.damage-waiver",
  ],
  /**
   * Tent builds are reserved weeks out and rarely re-book — 50%
   * forfeit inside 30 days, 3-week minimum notice to book.
   */
  policies: {
    refundWindowDays: 30,
    forfeitPct: 50,
    minLeadTimeHours: 504,
  },
  defaultCategorySeeds: [
    "Frame Tent",
    "Pole Tent",
    "Sailcloth Tent",
    "Canopy",
    "Sidewall",
  ],
  marketing: {
    landingPageSlug: "tent-rental-software",
    seoTitle: "Tent Rental Software for Event & Wedding Operators | Korent",
    seoDescription:
      "Online booking, anchoring spec on the pull sheet, setup-window timing, and sidewall add-ons — built for tent rental businesses serving weddings and events.",
    heroKicker: "Tent rental software",
    heroHeadline:
      "Stop juggling spreadsheets. Book tents online, dispatch crews with the right anchoring spec.",
    heroSubhead:
      "Customers pick a tent size, surface type, and add-ons on your branded site. Your crew gets a pull sheet with stakes, sandbags, or water barrels — matched to the venue surface — and an arrival time relative to the event start.",
    features: [
      {
        title: "Anchoring spec by surface",
        body: "Grass = stakes ×N, concrete = water barrels, asphalt = tie-downs. The pull sheet tells your crew exactly what to bring before they leave the yard.",
      },
      {
        title: "Setup-window arrival time on the pull sheet",
        body: "\"Arrive 11:00 AM for 1:00 PM event\" — the tent is up before guests arrive, no 6am text threads asking which house is first.",
      },
      {
        title: "Sidewalls, lighting, heating as checkbox add-ons",
        body: "Customer ticks the boxes at checkout; each accessory is its own SKU with its own pricing model. No SKU explosion.",
      },
      {
        title: "Guest-count capacity calculator on the storefront",
        body: "Visitors enter their guest count, see recommended tent sizes mapped to sq ft per person.",
      },
      {
        title: "Site-specific delivery notes",
        body: "Surface type, ground prep, gate width — captured at checkout, surfaced to dispatch and the driver.",
      },
      {
        title: "Damage deposit + waiver, automated",
        body: "Deposit collected at booking; liability waiver signed online before delivery. Spreadsheet finally takes the night off.",
      },
    ],
  },
  imageSlugs: {
    hero: "/marketing/tents/operator-site-check-tent-build.jpg",
    crew: "/marketing/tents/crew-raising-tent-pole-dawn.jpg",
    transitionBanner: "/marketing/tents/sailcloth-tent-lakeside-evening.jpg",
  },
  storefrontDefaults: {
    heroImagePath: "/storefront-defaults/hero/tents.jpg",
    headlineLead: "Tents, tabletop, and dance floors",
    headlineItalic: "for the moments that matter.",
    lede: "Weddings, corporate dinners, and milestone celebrations across {area}. Tents sized and styled to your guest count, with crew setup and breakdown included.",
    taglineLabel: "Event rentals",
    trustBadges: [
      { kicker: "Insured", statement: "Commercial liability coverage on every install, plus permit assistance when required." },
      { kicker: "On time", statement: "Crews arrive in the install window — never after dark on a wedding day." },
      { kicker: "Sized right", statement: "Site visits available across {area} to confirm guest count, layout, and surface." },
    ],
    vibeTiles: [
      { kicker: "For the couple", label: "Garden weddings", imagePath: "/storefront-defaults/hero/tents.jpg", href: "/inventory?vibe=weddings" },
      { kicker: "For the company", label: "Corporate dinners", imagePath: "/storefront-defaults/hero/dance-floors.jpg", href: "/inventory?vibe=corporate" },
      { kicker: "For the family", label: "Backyard dinners", imagePath: "/storefront-defaults/hero/tables-and-chairs.jpg", href: "/inventory?vibe=backyard" },
    ],
  },
};

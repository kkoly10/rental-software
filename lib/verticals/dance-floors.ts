import type { VerticalConfig } from "./types.ts";

/**
 * Dance floors & staging — parquet, black, white, LED light-up
 * floors plus the riser/stage section accessory tail. Pairs with
 * tent + tables/chairs as the wedding-and-banquet triad.
 *
 * Pricing model: flat-day OR per-unit (per 3'×3' section, for
 * irregular sizes). Both capabilities are declared; the operator
 * picks which one applies to each product. Surface variants live
 * in the variant-gallery (parquet / black / white / LED).
 */
export const danceFloorsVertical: VerticalConfig = {
  slug: "dance-floors",
  operatorDefaults: { depositPercentage: 50, orderMinimum: 300, deliveryFee: 125 },
  label: {
    en: "Dance floors",
    es: "Pistas de baile",
    fr: "Pistes de danse",
    pt: "Pistas de dança",
  },
  capabilities: [
    "pricing.flat-day",
    "pricing.per-unit",
    "setup.setup-window",
    "display.capacity-calculator",
    "display.structured-specs",
    "display.variant-gallery",
    "order.damage-waiver",
  ],
  /**
   * Install crews are scheduled a week out — 50% forfeit inside
   * 7 days; 72h minimum notice for a floor install.
   */
  policies: {
    refundWindowDays: 7,
    forfeitPct: 50,
    minLeadTimeHours: 72,
  },
  defaultCategorySeeds: [
    "Parquet Dance Floor",
    "Black Dance Floor",
    "White Dance Floor",
    "LED Light-Up Floor",
    "Riser / Stage Section",
  ],
  marketing: {
    landingPageSlug: "dance-floor-rental-software",
    seoTitle:
      "Dance Floor Rental Software for Weddings & Events | Korent",
    seoDescription:
      "Visual surface picker (parquet, black, white, LED), guest-count sizing, and crew assembly windows — built for dance floor and staging rental businesses.",
    heroKicker: "Dance floor rental software",
    heroHeadline:
      "16 sections, 1 hour to install. Take dance floor bookings online with the visual surface picker.",
    heroSubhead:
      "Customers enter guest count, see conservative + generous size recommendations, pick parquet or LED with a clickable thumbnail, and pay a deposit. Your crew gets a sectioned setup window on the pull sheet.",
    features: [
      {
        title: "Guest-count sizing calculator",
        body: "Industry rule (30–50% of guests dancing, 4 sq ft each, 3'×3' sections at 9 sq ft) returns conservative + generous section counts. Ceil never undersizes.",
      },
      {
        title: "Visual surface picker",
        body: "Parquet, black, white, LED light-up — clickable thumbnails on the PDP with optional price delta per surface.",
      },
      {
        title: "Setup window on the pull sheet",
        body: "Crew sees install start time (1–2 hours before event) and the section grid for the chosen size.",
      },
      {
        title: "Per-section pricing optional",
        body: "Bill flat-day for a 12×12 OR per-section for irregular sizes. Operator picks the model per product.",
      },
      {
        title: "Pairs cleanly with tent + tables/chairs",
        body: "Same operator, same checkout, same crew. The triad customer buys all three from your storefront in one cart.",
      },
    ],
  },
  imageSlugs: {
    hero: "/marketing/dance-floors/installer-laying-parquet-floor.jpg",
    crew: "/marketing/dance-floors/crew-carrying-floor-panels.jpg",
    transitionBanner: "/marketing/dance-floors/white-dance-floor-tent-night.jpg",
  },
  storefrontDefaults: {
    heroImagePath: "/storefront-defaults/hero/dance-floors.jpg",
    headlineLead: "Dance floors",
    headlineItalic: "built for the night.",
    lede: "Parquet, black-and-white, and LED dance floors with crew setup and breakdown across {area}. Sized to your guest count, leveled to your surface.",
    taglineLabel: "Event rentals",
    trustBadges: [
      { kicker: "Book online", statement: "Check availability and book online in minutes." },
      { kicker: "Local", statement: "Serving {area}." },
      { kicker: "Upfront pricing", statement: "See itemized pricing before you book — no surprises." },
    ],
    vibeTiles: [
      { kicker: "For the couple", label: "Weddings", imagePath: "/storefront-defaults/hero/dance-floors.jpg", href: "/inventory?vibe=weddings" },
      { kicker: "For the company", label: "Corporate galas", imagePath: "/storefront-defaults/hero/tents.jpg", href: "/inventory?vibe=corporate" },
      { kicker: "For the milestone", label: "Anniversary parties", imagePath: "/storefront-defaults/hero/tables-and-chairs.jpg", href: "/inventory?vibe=milestone" },
    ],
  },
};

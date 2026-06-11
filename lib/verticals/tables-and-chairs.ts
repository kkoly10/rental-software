import type { VerticalConfig } from "./types.ts";

/**
 * Tables & chairs — chiavari chairs, banquet rounds, folding,
 * cocktail tables. The biggest single segment inside IBISWorld's
 * $8.5B party-supply rental industry and a common bundle with
 * tent rentals.
 *
 * Pricing model: per-unit. $5/chair × 200 = $1,000, with a
 * category-level $ minimum so tiny orders don't undercut delivery
 * costs. Setup service ($1/chair to arrange) lands as an optional
 * add-on rather than a price hike on the chair itself.
 */
export const tablesAndChairsVertical: VerticalConfig = {
  slug: "tables-and-chairs",
  label: {
    en: "Tables & chairs",
    es: "Mesas y sillas",
    fr: "Tables et chaises",
    pt: "Mesas e cadeiras",
  },
  capabilities: [
    "pricing.per-unit",
    "order.minimum-order",
    "display.structured-specs",
    "display.variant-gallery",
    "composition.add-ons",
  ],
  /**
   * Commodity inventory re-rents easily — full refund until 3
   * days out, no forfeit; 48h notice to pull and stage an order.
   */
  policies: {
    refundWindowDays: 3,
    forfeitPct: 0,
    minLeadTimeHours: 48,
  },
  defaultCategorySeeds: [
    "Chiavari Chair",
    "Folding Chair",
    "Banquet Round Table",
    "Banquet Rectangular Table",
    "Cocktail Table",
  ],
  marketing: {
    landingPageSlug: "tables-and-chairs-rental-software",
    seoTitle:
      "Table & Chair Rental Software for Banquet Operators | Korent",
    seoDescription:
      "Per-unit pricing, order minimums, style filters, and optional setup-service add-ons — built for chiavari chair and banquet table rental businesses.",
    heroKicker: "Tables & chairs rental software",
    heroHeadline:
      "$5 a chair, $600 minimum, setup service optional. Built right into your storefront.",
    heroSubhead:
      "Customers pick chiavari color or banquet shape, enter the count, and add optional setup service. The line shows per-unit math; the minimum-order check blocks tiny orders that don't cover delivery.",
    features: [
      {
        title: "Per-unit pricing with unit labels",
        body: "Storefront shows \"$5 per chair × 200 = $1,000\" instead of opaque math. Customers see exactly what they're paying.",
      },
      {
        title: "Order minimums enforced at checkout",
        body: "Set a $600 category floor; the storefront blocks below with a friendly \"add $X more\" message instead of a hard error.",
      },
      {
        title: "Style + color variant picker",
        body: "Chiavari gold / silver / clear, banquet round / rectangular, folding white / black — clickable thumbnails on the PDP.",
      },
      {
        title: "Optional setup service as an add-on",
        body: "Charge $1/chair if the crew arranges them; customer opts in at checkout. No surcharge required.",
      },
      {
        title: "Bulk-friendly storefront",
        body: "Customers can pick 200 chairs without scrolling through 200 product rows. One SKU, count input, done.",
      },
    ],
  },
  imageSlugs: {
    hero: "/home/operator-with-ipad.jpg",
    crew: "/home/crew-loading-trailer.jpg",
    inventory: "/home/inventory-warehouse.jpg",
  },
  storefrontDefaults: {
    heroImagePath: "/storefront-defaults/hero/tables-and-chairs.jpg",
    headlineLead: "Chairs, tables, and tabletop",
    headlineItalic: "styled for the day.",
    lede: "Bring your vision to the table. Curated chairs, table styles, and linens across {area}, delivered, styled, and broken down by our crew.",
    taglineLabel: "Event rentals",
    trustBadges: [
      { kicker: "Curated", statement: "Hand-selected silhouettes and linens — never warehouse-grade banquet stock." },
      { kicker: "Counted", statement: "Inventory tied to your guest count; we deliver exactly what's needed, no fillers." },
      { kicker: "On time", statement: "Setup completed before guests arrive across {area}." },
    ],
    vibeTiles: [
      { kicker: "For the couple", label: "Weddings", imagePath: "/storefront-defaults/hero/tables-and-chairs.jpg", href: "/inventory?vibe=weddings" },
      { kicker: "For the family", label: "Backyard dinners", imagePath: "/storefront-defaults/hero/tents.jpg", href: "/inventory?vibe=backyard" },
      { kicker: "For the company", label: "Corporate dinners", imagePath: "/storefront-defaults/hero/dance-floors.jpg", href: "/inventory?vibe=corporate" },
    ],
  },
};

import type { VerticalConfig } from "./types.ts";

/**
 * Photo booths — the marquee variant-gallery vertical. Backdrop
 * choice is the customer-facing differentiator; every serious
 * competitor (Check Cherry, Snappic) has a clickable thumbnail
 * picker. Pricing is industry-standard per-hour with a 3-hour
 * minimum; attendant is included for the full rental window with
 * optional overage billing for hours beyond.
 *
 * Pricing recon (2026):
 *   - 3-hour minimum is the industry standard.
 *   - $200/hr base; $150/hr additional-hour add-on common.
 *   - Onsite attendant included for full rental.
 *   - Custom step-and-repeat backdrops $150-$300; floral walls
 *     $950+.
 *   - Bronze/Silver/Gold package tiers standard.
 */
export const photoBoothsVertical: VerticalConfig = {
  slug: "photo-booths",
  label: {
    en: "Photo booths",
    es: "Cabinas de fotos",
    fr: "Cabines photo",
    pt: "Cabines de fotos",
  },
  capabilities: [
    "pricing.per-hour",
    "setup.setup-window",
    "service.onsite-attendant",
    "display.variant-gallery",
    "display.structured-specs",
    "composition.add-ons",
    "order.damage-waiver",
  ],
  /**
   * Booth + attendant are committed per event date — 50% forfeit
   * inside 14 days; 72h notice to staff an attendant.
   */
  policies: {
    refundWindowDays: 14,
    forfeitPct: 50,
    minLeadTimeHours: 72,
  },
  defaultCategorySeeds: [
    "Open-Air Photo Booth",
    "Enclosed Photo Booth",
    "360° Video Booth",
    "Mirror Photo Booth",
    "Selfie Pod",
  ],
  marketing: {
    landingPageSlug: "photo-booth-rental-software",
    seoTitle: "Photo Booth Rental Software with Backdrop Picker | Korent",
    seoDescription:
      "Per-hour pricing with 3-hour minimum, visual backdrop catalog, attendant scheduling on the pull sheet, and structured PDP specs — built for photo booth rental businesses.",
    heroKicker: "Photo booth rental software",
    heroHeadline:
      "Backdrop catalog, attendant scheduled, deposit collected. Take photo booth bookings online with a clickable visual picker.",
    heroSubhead:
      "Customers pick a backdrop from a clickable gallery, see the 3-hour minimum priced honestly, and pay a deposit. Your crew gets the attendant schedule and arrival window on the pull sheet.",
    features: [
      {
        title: "Per-hour billing with 3-hour minimum",
        body: "Industry standard math: $200/hr base, minimum block floors the line total. Submit-time dispatch reads the customer's start/end times and bills the real hours, never undercharges below the minimum.",
      },
      {
        title: "Visual backdrop picker",
        body: "Every serious competitor has one. Operator uploads thumbnails per backdrop; PDP renders a clickable gallery with optional price-delta per variant.",
      },
      {
        title: "Attendant scheduled on the pull sheet",
        body: "Crew line item gains an ` · Attendant (Nh incl.)` suffix on the pull sheet. Overage past the included hours bills against `attendant_overage_hours` for refund / dispute lookups.",
      },
      {
        title: "Extra-hour add-on built-in",
        body: "Composition.add-ons lets the operator define `Extra Hour` as a $150 add-on product. Customer selects it on the PDP and it lands as a child order_items line via parent_order_item_id.",
      },
      {
        title: "Structured PDP specs",
        body: "Power requirements, footprint, included props — the customer reads the same definition list every operator uses, sorted by the operator's display order.",
      },
      {
        title: "Solo-to-team scaling",
        body: "Multi-booth operators run multiple events same day. The dashboard nav shows Deliveries + Crew Mobile so dispatchers can see who's assigned where.",
      },
    ],
  },
  imageSlugs: {
    hero: "/marketing/photo-booths/attendant-setting-up-booth.jpg",
    crew: "/marketing/photo-booths/attendant-arranging-prints.jpg",
    transitionBanner: "/marketing/photo-booths/booth-hedge-wall-wedding.jpg",
  },
  storefrontDefaults: {
    heroImagePath: "/storefront-defaults/hero/photo-booths.jpg",
    headlineLead: "Photo booths",
    headlineItalic: "with the editorial feel.",
    lede: "Open-air and enclosed booths with custom print designs across {area}. Crew-attended every event — no kiosk left unattended.",
    taglineLabel: "Event rentals",
    trustBadges: [
      { kicker: "Attended", statement: "A trained attendant runs every booth — set-up, breakdown, and live troubleshooting." },
      { kicker: "Custom", statement: "Bespoke print template designed for your event before delivery, free of charge." },
      { kicker: "Trusted", statement: "Hundreds of weddings, brand activations, and private events across {area}." },
    ],
    vibeTiles: [
      { kicker: "For the couple", label: "Weddings", imagePath: "/storefront-defaults/hero/photo-booths.jpg", href: "/inventory?vibe=weddings" },
      { kicker: "For the brand", label: "Activations", imagePath: "/storefront-defaults/hero/dance-floors.jpg", href: "/inventory?vibe=corporate" },
      { kicker: "For the celebration", label: "Private parties", imagePath: "/storefront-defaults/hero/tables-and-chairs.jpg", href: "/inventory?vibe=parties" },
    ],
  },
};

import type { VerticalConfig } from "./types.ts";

/**
 * Inflatables — the mature reference vertical. Bounce houses, water
 * slides, combo units, obstacle courses, party games.
 *
 * Currently the only vertical with a true 10/10 fit; future
 * verticals (tents, tables & chairs, dance floors, photo booths,
 * concessions) will compose subsets of these capabilities plus a few
 * new ones (per-hour pricing, per-unit pricing, setup window, etc.).
 *
 * Image assets currently live at /home/* paths inherited from the
 * pre-vertical landing-page setup. When Phase 2 ships dedicated
 * vertical landing pages, these will move to /verticals/inflatables/*.
 */
export const inflatableVertical: VerticalConfig = {
  slug: "inflatable",
  label: {
    en: "Inflatables",
    es: "Inflables",
    fr: "Structures gonflables",
    pt: "Insufláveis",
  },
  capabilities: [
    "pricing.flat-day",
    "setup.anchoring",
    "setup.surface-type",
    "mode.wet-dry",
  ],
  /**
   * Bouncers re-rent on a day's notice — stay flexible: full
   * refund until 24h out, no forfeit.
   */
  policies: {
    refundWindowDays: 1,
    forfeitPct: 0,
    minLeadTimeHours: 24,
  },
  defaultCategorySeeds: [
    "Bounce House",
    "Water Slide",
    "Combo Unit",
    "Obstacle Course",
    "Game",
  ],
  marketing: {
    landingPageSlug: "inflatable-rental-software",
    seoTitle: "Inflatable Rental Software for Bounce House Operators | Korent",
    seoDescription:
      "Online booking, delivery routing, damage deposits, and crew dispatch — built for bounce house, water slide, and combo unit rental businesses. Start free; no credit card.",
    heroKicker: "Inflatable rental software",
    heroHeadline: "Stop answering availability calls. Start taking bounce house bookings online.",
    heroSubhead:
      "Customers check real-time availability, pick wet or dry, and pay a deposit on your branded site — while your crew gets a pull sheet that lists the right anchoring spec and arrival time.",
    features: [
      {
        title: "Wet/dry mode pricing built in",
        body: "Customers pick wet or dry at checkout; the wet upcharge applies per unit, never as a flat add-on. Pull sheet shows the chosen mode for the crew.",
      },
      {
        title: "Anchoring spec on the pull sheet",
        body: "Stakes, sandbags, water barrels, concrete weights — your crew sees 'Bring: stakes ×6' on the printed sheet, no morning text threads.",
      },
      {
        title: "Surface-aware delivery notes",
        body: "Grass, concrete, asphalt — captured at checkout, surfaced to dispatch and the driver before they leave the yard.",
      },
      {
        title: "Damage deposit + waiver, automated",
        body: "Deposit collected at booking. Liability waiver signed online before delivery. Your spreadsheet finally gets a vacation.",
      },
      {
        title: "Built for solo operators and growing crews",
        body: "Start as a one-person shop. Add crew members with the right access — drivers see today's stops, office staff don't see payments unless you let them.",
      },
      {
        title: "Real customer reviews, not stock testimonials",
        body: "Customers can leave a public review after the event. Your storefront builds trust without you chasing it.",
      },
    ],
  },
  imageSlugs: {
    hero: "/home/operator-with-ipad.jpg",
    crew: "/home/crew-loading-trailer.jpg",
    inventory: "/home/inventory-warehouse.jpg",
    transitionBanner: "/home/event-setup.jpg",
    customerPhone: "/home/customer-booking-phone.jpg",
  },
  storefrontDefaults: {
    heroImagePath: "/storefront-defaults/hero/inflatable.jpg",
    headlineLead: "Bounce houses and water slides,",
    headlineItalic: "delivered with care.",
    lede: "Backyard birthdays, school events, and neighborhood celebrations across {area}. Every unit commercially insured, inspected, and set up before guests arrive.",
    taglineLabel: "Party rentals",
    trustBadges: [
      { kicker: "Insured", statement: "Commercial liability insurance on every unit, every event." },
      { kicker: "On time", statement: "Crews arrive within a one-hour delivery window, set up before guests." },
      { kicker: "Trusted", statement: "More than 500 events delivered across {area}." },
    ],
    vibeTiles: [
      { kicker: "For the kids", label: "Backyard birthdays", imagePath: "/storefront-defaults/hero/inflatable.jpg", href: "/inventory?vibe=birthdays" },
      { kicker: "For the school", label: "Field-day events", imagePath: "/storefront-defaults/hero/dance-floors.jpg", href: "/inventory?vibe=school" },
      { kicker: "For the block", label: "Neighborhood parties", imagePath: "/storefront-defaults/hero/concessions.jpg", href: "/inventory?vibe=neighborhood" },
    ],
  },
};

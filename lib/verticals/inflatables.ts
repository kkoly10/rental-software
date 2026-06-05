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
  defaultCategorySeeds: [
    "Bounce House",
    "Water Slide",
    "Combo Unit",
    "Obstacle Course",
    "Game",
  ],
  marketing: {
    landingPageSlug: "inflatable-rental-software",
  },
  imageSlugs: {
    hero: "/home/operator-with-ipad.jpg",
    crew: "/home/crew-loading-trailer.jpg",
    inventory: "/home/inventory-warehouse.jpg",
    transitionBanner: "/home/event-setup.jpg",
    customerPhone: "/home/customer-booking-phone.jpg",
  },
};

import type { World } from "./types.ts";

/**
 * The 7 marketplace worlds (spec §3) with launch status per §31:
 * hosting-and-events launches live (supply seeded by Korent SaaS
 * operators); the other six run in smoke-test mode — browsable,
 * waitlist + pre-listings, NOT bookable — until their graduation
 * gates are met in a metro.
 */
export const worlds: readonly World[] = [
  {
    slug: "hosting-and-events",
    label: "Hosting & Events",
    icon: "🎪",
    tagline: "Tents, seating, AV and everything that makes a party",
    status: "live",
  },
  {
    slug: "home-and-projects",
    label: "Home & Projects",
    icon: "🔨",
    tagline: "Ladders, sanders, sprayers — finish the project, return the tool",
    status: "smoke_test",
  },
  {
    slug: "baby-gear",
    label: "Baby Gear",
    icon: "🍼",
    tagline: "Cribs, strollers and travel gear — sanitized and recall-checked",
    status: "smoke_test",
  },
  {
    slug: "creator-gear",
    label: "Creator Gear",
    icon: "🎥",
    tagline: "Cameras, lenses, lights and audio for your next shoot",
    status: "smoke_test",
  },
  {
    slug: "trailers-and-hauling",
    label: "Trailers & Hauling",
    icon: "🚛",
    tagline: "Utility trailers, moving gear and tie-downs",
    status: "smoke_test",
  },
  {
    slug: "office-and-pop-up",
    label: "Office & Pop-Up",
    icon: "💼",
    tagline: "Desks, displays and booth kits for markets and offsites",
    status: "smoke_test",
  },
  {
    slug: "seasonal-and-emergency",
    label: "Seasonal & Emergency",
    icon: "⛈️",
    tagline: "Backup power, pumps, heaters — fast help when weather hits",
    status: "smoke_test",
  },
];

export const worldBySlug: ReadonlyMap<string, World> = new Map(
  worlds.map((w) => [w.slug, w] as const),
);

/**
 * World-tile + hero photography for the marketplace (mockup
 * transition, June 2026). Files live in public/market/photos with
 * credits in CREDITS.md (Unsplash, free license). Listing cards use
 * seller-uploaded photos; these stills only dress platform surfaces
 * (home hero, world tiles/banners, store covers).
 */

export const HERO_PHOTO = "/market/photos/chairs-wedding-event.jpg";

const WORLD_PHOTOS: Record<string, string> = {
  "hosting-and-events": "/market/photos/tent-event-frame.jpg",
  "home-and-projects": "/market/photos/home-projects.jpg",
  "baby-gear": "/market/photos/baby-gear.jpg",
  "creator-gear": "/market/photos/camera-creator-gear.jpg",
  "trailers-and-hauling": "/market/photos/trailer-hauling.jpg",
  "office-and-pop-up": "/market/photos/office-popup.jpg",
  "seasonal-and-emergency": "/market/photos/seasonal-emergency.jpg",
};

export function worldPhoto(slug: string): string | null {
  return WORLD_PHOTOS[slug] ?? null;
}

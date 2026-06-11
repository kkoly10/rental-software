import { getWorld } from "@/lib/market/registry";

/**
 * Lightweight emoji art for listings without a photo yet — category
 * first, world icon second, crate last. One map shared by every
 * surface (cards, PDP gallery, booking thumbnails) so a speaker never
 * renders as a circus tent again.
 */
const CATEGORY_ICONS: Record<string, string> = {
  // hosting-and-events
  "tents-and-canopies": "⛺",
  tables: "🪑",
  "chairs-and-seating": "🪑",
  "lounge-and-event-furniture": "🛋️",
  "dance-floors-and-staging": "🕺",
  "photo-booths": "📸",
  "concessions-and-food-service": "🍿",
  "audio-visual-and-presentation": "📽️",
  "games-and-entertainment": "🎯",
  "decor-and-backdrops": "🎀",
  "climate-and-comfort": "🌬️",
  "event-utility-equipment": "🔌",
};

export function categoryIcon(
  worldSlug: string | null | undefined,
  categorySlug: string | null | undefined,
): string {
  if (categorySlug && CATEGORY_ICONS[categorySlug]) return CATEGORY_ICONS[categorySlug];
  const world = worldSlug ? getWorld(worldSlug) : null;
  return world?.icon ?? "📦";
}

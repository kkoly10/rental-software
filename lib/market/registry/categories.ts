import type { MarketCategory, RiskFamilySlug, SecondaryTag, WorldSlug } from "./types.ts";

/**
 * Full category tree (spec §4), each category mapped to a risk family
 * (spec §5) with optional secondary tags and operating-matrix
 * overrides (spec §6).
 *
 * Category slugs are world-scoped (spec §3) — `chairs-and-seating`
 * legitimately appears in both hosting-and-events and
 * office-and-pop-up. Always address a category as world/category.
 */

function cat(
  worldSlug: WorldSlug,
  slug: string,
  label: string,
  riskFamilySlug: RiskFamilySlug,
  tags: readonly SecondaryTag[] = [],
  overrides?: MarketCategory["overrides"],
): MarketCategory {
  return { worldSlug, slug, label, riskFamilySlug, tags, overrides };
}

export const categories: readonly MarketCategory[] = [
  // ── home-and-projects ─────────────────────────────────────────────
  cat("home-and-projects", "access-and-ladders", "Access & Ladders", "passive-standard"),
  cat("home-and-projects", "yard-and-landscaping", "Yard & Landscaping", "powered-standard", ["powered-equipment"]),
  cat("home-and-projects", "cleaning-and-restoration", "Cleaning & Restoration", "powered-standard", ["sanitation-sensitive"]),
  cat("home-and-projects", "flooring-and-interior-finishing", "Flooring & Interior Finishing", "powered-standard", ["powered-equipment"]),
  cat("home-and-projects", "cutting-drilling-and-demolition", "Cutting, Drilling & Demolition", "powered-standard", ["powered-equipment"]),
  cat("home-and-projects", "painting-and-surface-prep", "Painting & Surface Prep", "powered-standard"),
  cat("home-and-projects", "power-and-jobsite-support", "Power & Jobsite Support", "powered-standard", ["powered-equipment"]),
  cat("home-and-projects", "staging-and-temporary-furniture", "Staging & Temporary Furniture", "furniture-standard", ["furniture", "staging-furniture"]),
  cat("home-and-projects", "inspection-and-specialty", "Inspection & Specialty", "electronics-standard", ["high-value"]),

  // ── hosting-and-events (LIVE world) ───────────────────────────────
  cat("hosting-and-events", "tents-and-canopies", "Tents & Canopies", "multi-component-event", ["onsite-setup", "multi-component", "delivery-heavy"]),
  cat("hosting-and-events", "tables", "Tables", "furniture-standard", ["event-furniture", "delivery-heavy"]),
  cat("hosting-and-events", "chairs-and-seating", "Chairs & Seating", "furniture-standard", ["event-furniture", "delivery-heavy"]),
  cat("hosting-and-events", "lounge-and-event-furniture", "Lounge & Event Furniture", "furniture-standard", ["lounge-furniture", "event-furniture"]),
  cat("hosting-and-events", "dance-floors-and-staging", "Dance Floors & Staging", "multi-component-event", ["onsite-setup", "multi-component"]),
  cat("hosting-and-events", "photo-booths", "Photo Booths", "electronics-standard", ["electric-equipment"]),
  cat("hosting-and-events", "concessions-and-food-service", "Concessions & Food Service", "food-contact", ["food-contact", "sanitation-sensitive"]),
  cat("hosting-and-events", "audio-visual-and-presentation", "Audio/Visual & Presentation", "electronics-standard", ["electric-equipment"]),
  cat("hosting-and-events", "climate-and-comfort", "Climate & Comfort", "powered-standard", ["powered-equipment"]),
  cat("hosting-and-events", "decor-and-backdrops", "Decor & Backdrops", "passive-standard"),
  cat("hosting-and-events", "games-and-entertainment", "Games & Entertainment", "passive-standard"),
  cat("hosting-and-events", "event-utility-equipment", "Event Utility Equipment", "powered-standard", ["powered-equipment"]),

  // ── baby-gear ──────────────────────────────────────────────────────
  cat("baby-gear", "sleep-and-nursery", "Sleep & Nursery", "baby-sensitive", ["child-contact", "sanitation-sensitive"]),
  cat("baby-gear", "strollers-and-mobility", "Strollers & Mobility", "baby-sensitive", ["child-contact"]),
  cat("baby-gear", "feeding-and-mealtime", "Feeding & Mealtime", "baby-sensitive", ["child-contact", "food-contact", "sanitation-sensitive"]),
  cat("baby-gear", "monitoring-and-safety", "Monitoring & Safety", "baby-sensitive", ["child-contact", "electric-equipment"], { proofOfFunctionRequired: true }),
  cat("baby-gear", "play-and-soothing", "Play & Soothing", "baby-sensitive", ["child-contact", "sanitation-sensitive"]),
  cat("baby-gear", "travel-and-on-the-go", "Travel & On-the-Go", "baby-sensitive", ["child-contact"]),
  cat("baby-gear", "premium-support-gear", "Premium Support Gear", "baby-sensitive", ["child-contact", "high-value"], { depositPct: 30, identityVerification: "full_id" }),

  // ── creator-gear ───────────────────────────────────────────────────
  cat("creator-gear", "cameras-and-bodies", "Cameras & Bodies", "high-value-electronics", ["high-value", "serial-required", "high-fraud-risk"]),
  cat("creator-gear", "lenses-and-optics", "Lenses & Optics", "high-value-electronics", ["high-value", "serial-required", "high-fraud-risk"]),
  cat("creator-gear", "audio-and-podcast", "Audio & Podcast", "electronics-standard", ["electric-equipment"]),
  cat("creator-gear", "lighting-and-grip", "Lighting & Grip", "electronics-standard", ["electric-equipment"]),
  cat("creator-gear", "support-and-stabilization", "Support & Stabilization", "electronics-standard", []),
  cat("creator-gear", "streaming-and-production", "Streaming & Production", "high-value-electronics", ["high-value", "multi-component"]),
  cat("creator-gear", "backgrounds-and-sets", "Backgrounds & Sets", "passive-standard", ["staging-furniture"]),
  cat("creator-gear", "monitors-and-accessories", "Monitors & Accessories", "electronics-standard", []),
  cat("creator-gear", "event-capture-systems", "Event Capture Systems", "high-value-electronics", ["high-value", "multi-component"]),

  // ── trailers-and-hauling ───────────────────────────────────────────
  cat("trailers-and-hauling", "utility-and-flatbed-trailers", "Utility & Flatbed Trailers", "towable-road", ["vin-required", "high-fraud-risk"]),
  cat("trailers-and-hauling", "enclosed-trailers", "Enclosed Trailers", "towable-road", ["vin-required", "high-fraud-risk"]),
  cat("trailers-and-hauling", "dump-trailers", "Dump Trailers", "towable-road", ["vin-required", "high-fraud-risk"]),
  cat("trailers-and-hauling", "vehicle-transport", "Vehicle Transport", "towable-road", ["vin-required", "high-fraud-risk"]),
  cat("trailers-and-hauling", "moving-equipment", "Moving Equipment", "passive-standard", ["pickup-preferred"]),
  cat("trailers-and-hauling", "cargo-carriers-and-hitch-gear", "Cargo Carriers & Hitch Gear", "passive-standard", ["pickup-preferred"]),
  cat("trailers-and-hauling", "tie-down-and-hauling-accessories", "Tie-Down & Hauling Accessories", "passive-standard", ["pickup-preferred"]),

  // ── office-and-pop-up ──────────────────────────────────────────────
  cat("office-and-pop-up", "desks-and-workstations", "Desks & Workstations", "furniture-standard", ["furniture", "office-furniture"]),
  cat("office-and-pop-up", "chairs-and-seating", "Chairs & Seating", "furniture-standard", ["furniture", "office-furniture"]),
  cat("office-and-pop-up", "tables-and-meeting-furniture", "Tables & Meeting Furniture", "furniture-standard", ["furniture", "office-furniture"]),
  cat("office-and-pop-up", "displays-and-signage", "Displays & Signage", "passive-standard", ["staging-furniture"]),
  cat("office-and-pop-up", "presentation-and-av", "Presentation & AV", "electronics-standard", ["electric-equipment"]),
  cat("office-and-pop-up", "pos-and-check-in", "POS & Check-In", "electronics-standard", ["high-fraud-risk"], { identityVerification: "full_id" }),
  cat("office-and-pop-up", "printing-and-scanning", "Printing & Scanning", "electronics-standard", []),
  cat("office-and-pop-up", "wifi-power-and-connectivity", "WiFi, Power & Connectivity", "electronics-standard", ["electric-equipment"]),
  cat("office-and-pop-up", "booth-fixtures-and-merch-displays", "Booth Fixtures & Merch Displays", "furniture-standard", ["staging-furniture"]),
  cat("office-and-pop-up", "office-furniture", "Office Furniture", "furniture-standard", ["furniture", "office-furniture"]),

  // ── seasonal-and-emergency ─────────────────────────────────────────
  cat("seasonal-and-emergency", "backup-power", "Backup Power", "restoration-and-emergency", ["powered-equipment"]),
  cat("seasonal-and-emergency", "water-damage-and-restoration", "Water Damage & Restoration", "restoration-and-emergency", ["powered-equipment"]),
  cat("seasonal-and-emergency", "heating-and-cooling", "Heating & Cooling", "powered-standard", ["powered-equipment"]),
  cat("seasonal-and-emergency", "storm-and-cleanup", "Storm & Cleanup", "powered-standard", ["powered-equipment"]),
  cat("seasonal-and-emergency", "snow-and-ice", "Snow & Ice", "powered-standard", ["powered-equipment"]),
  cat("seasonal-and-emergency", "temporary-lighting-and-safety", "Temporary Lighting & Safety", "powered-standard", ["electric-equipment"]),
  cat("seasonal-and-emergency", "pumps-and-drainage", "Pumps & Drainage", "restoration-and-emergency", ["powered-equipment"]),
  cat("seasonal-and-emergency", "temporary-shelter-and-site-protection", "Temporary Shelter & Site Protection", "passive-standard", ["onsite-setup"]),
];

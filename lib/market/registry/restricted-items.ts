import type { RestrictedItemRule } from "./types.ts";

/**
 * Restricted / prohibited items seed list (spec §25).
 *
 * Four levels: prohibited, restricted_manual_review,
 * allowed_with_extra_requirements, allowed_standard. Listing
 * moderation checks titles/categories against this list; anything
 * geographySensitive must clear a per-jurisdiction legal review
 * before the relevant world goes live there (spec §30 — do not fake).
 */
export const restrictedItems: readonly RestrictedItemRule[] = [
  // ── Prohibited outright ───────────────────────────────────────────
  { slug: "firearms-ammo", label: "Firearms & ammunition", level: "prohibited", note: "Federal/state licensing regimes; never listable.", geographySensitive: true },
  { slug: "explosives-fireworks", label: "Explosives & fireworks", level: "prohibited", note: "Hazmat + permitting; never listable.", geographySensitive: true },
  { slug: "hazardous-chemicals", label: "Hazardous chemicals", level: "prohibited", note: "Storage/transport liability; never listable." },
  { slug: "illegal-surveillance", label: "Covert surveillance equipment", level: "prohibited", note: "Wiretap/peeping statutes vary; categorically banned.", geographySensitive: true },
  { slug: "recalled-baby-products", label: "Recalled baby products", level: "prohibited", note: "CPSC recall list match = automatic rejection. Recall check required for all baby-gear listings." },
  { slug: "medical-life-support", label: "Medical / life-support devices", level: "prohibited", note: "FDA-regulated; prohibited until a compliance program exists." },
  { slug: "stolen-unverifiable", label: "Stolen or unverifiable property", level: "prohibited", note: "Serial/VIN verification failure on serial-required categories = rejection." },
  { slug: "weapons-adjacent", label: "Weapon-adjacent items (crossbows, etc.)", level: "prohibited", note: "Age + liability; revisit only with legal sign-off.", geographySensitive: true },

  // ── Restricted: listable only after manual review ─────────────────
  { slug: "unverified-trailers", label: "Trailers without title/VIN verification", level: "restricted_manual_review", note: "VIN + registration photo required before a trailer listing can publish.", geographySensitive: true },
  { slug: "motorized-road-vehicles", label: "Motorized road vehicles", level: "restricted_manual_review", note: "Out of marketplace scope at launch; insurance answer required first.", geographySensitive: true },
  { slug: "commercial-kitchen", label: "Commercial cooking equipment (open flame / fryers)", level: "restricted_manual_review", note: "Fire-code exposure; reviewed case-by-case.", geographySensitive: true },
  { slug: "climbing-safety-gear", label: "Life-safety climbing/fall gear", level: "restricted_manual_review", note: "Single-failure-point items; inspection evidence required." },

  // ── Allowed with extra requirements ───────────────────────────────
  { slug: "high-value-electronics", label: "High-value electronics (> $2,000 replacement)", level: "allowed_with_extra_requirements", note: "Serial number + proof-of-function video + full ID verification (spec §6)." },
  { slug: "baby-gear-general", label: "Baby gear (non-recalled)", level: "allowed_with_extra_requirements", note: "Recall self-attestation + strict sanitation class + condition photos." },
  { slug: "food-contact-equipment", label: "Food-contact equipment", level: "allowed_with_extra_requirements", note: "Sanitation attestation each rental; strict sanitation class." },
  { slug: "generators-fuel", label: "Generators & fueled equipment", level: "allowed_with_extra_requirements", note: "Drained-fuel return policy + proof-of-function." },
];

const bySlug = new Map(restrictedItems.map((r) => [r.slug, r] as const));

export function getRestrictedItemRule(slug: string): RestrictedItemRule | undefined {
  return bySlug.get(slug);
}

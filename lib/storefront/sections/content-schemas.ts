// Relative `.ts` imports are NOT used here (this file imports `zod`, a package,
// which resolves fine under `node --test --experimental-strip-types`). Kept
// dependency-light (zod only, no server deps) so the schemas stay unit-testable
// and importable from both the RSC render path and the builder UI.
//
// PR-1c: per-section CONTENT settings schemas for the two editable sections —
// hero + about. These validate `document.sections[id].settings` and bound the
// editable text fields (spec §2: limits enforced on save). All fields are
// OPTIONAL so an absent setting falls back to today's behavior in the component
// (byte-for-byte safety — see hero.tsx / about-section.tsx fallbacks).
import { z } from "zod";

// Length caps mirror the bounded-input requirement: keep stored JSON small and
// the rendered layout from breaking. Trim is applied so whitespace-only values
// don't masquerade as content.
export const HERO_HEADLINE_MAX = 120;
export const HERO_MESSAGE_MAX = 300;
export const ABOUT_HEADING_MAX = 120;
export const ABOUT_BODY_MAX = 4000;

/** Optional, bounded image URL. Must be an absolute http(s) URL when present. */
const imageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
    message: "Image URL must be an http(s) link.",
  })
  .optional();

/**
 * hero settings: headline + message text + a swapped hero image URL. All
 * optional — any omitted field falls back to the component's existing
 * getOrganizationSettings()/vertical-default logic.
 */
export const heroSettingsSchema = z.object({
  headline: z.string().trim().max(HERO_HEADLINE_MAX).optional(),
  message: z.string().trim().max(HERO_MESSAGE_MAX).optional(),
  imageUrl: imageUrlSchema,
});

/**
 * about settings: heading override + body copy. Both optional — an omitted
 * heading falls back to the i18n default title; an omitted body falls back to
 * the legacy `text` prop (content_settings.aboutText).
 */
export const aboutSettingsSchema = z.object({
  heading: z.string().trim().max(ABOUT_HEADING_MAX).optional(),
  body: z.string().trim().max(ABOUT_BODY_MAX).optional(),
});

export type HeroSettings = z.infer<typeof heroSettingsSchema>;
export type AboutSettings = z.infer<typeof aboutSettingsSchema>;

/**
 * Map of section type → the Zod schema validating that type's `settings`. Only
 * the editable PR-1c types are listed; types absent from this map carry no
 * validated content settings yet (their `settings` is ignored on render).
 */
export const SECTION_CONTENT_SCHEMAS = {
  hero: heroSettingsSchema,
  about: aboutSettingsSchema,
} as const;

export type ContentEditableSectionType = keyof typeof SECTION_CONTENT_SCHEMAS;

/** Whether a section type has an editable content settings form in PR-1c. */
export function isContentEditableSectionType(
  type: string
): type is ContentEditableSectionType {
  return Object.prototype.hasOwnProperty.call(SECTION_CONTENT_SCHEMAS, type);
}

/**
 * Defensively parse a section's stored `settings` against the hero schema.
 * Returns an empty object (= use all fallbacks) when the settings are absent or
 * malformed, so the render path can never crash on bad stored data.
 */
export function parseHeroSettings(settings: unknown): HeroSettings {
  const parsed = heroSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : {};
}

/** Defensive parse of a section's stored `settings` against the about schema. */
export function parseAboutSettings(settings: unknown): AboutSettings {
  const parsed = aboutSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : {};
}

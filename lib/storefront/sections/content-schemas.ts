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
// PR-1d: trust / testimonials / faq bounds (spec §2: limits enforced on save).
export const TRUST_TITLE_MAX = 60;
export const TRUST_DESCRIPTION_MAX = 200;
export const TRUST_BADGES_MAX = 3;
export const TESTIMONIAL_NAME_MAX = 80;
export const TESTIMONIAL_TEXT_MAX = 600;
export const TESTIMONIALS_MAX = 12;
export const FAQ_QUESTION_MAX = 200;
export const FAQ_ANSWER_MAX = 1000;
export const FAQ_ITEMS_MAX = 20;
// PR-1e: custom (operator-added) section bounds.
export const CUSTOM_RICH_HEADING_MAX = 120;
export const CUSTOM_RICH_BODY_MAX = 4000;
export const CUSTOM_IMAGE_ALT_MAX = 200;
export const CUSTOM_IMAGE_CAPTION_MAX = 300;
export const CUSTOM_GALLERY_ALT_MAX = 200;
export const CUSTOM_GALLERY_IMAGES_MAX = 12;
// PR-1f: previously non-editable TEXT sections (closing / how-it-works /
// service-area / featured). Bounds keep stored JSON small and the layout intact.
export const CLOSING_HEADING_MAX = 120;
export const CLOSING_BODY_MAX = 300;
export const CLOSING_BUTTON_LABEL_MAX = 40;
export const HOW_IT_WORKS_HEADING_MAX = 120;
export const HOW_IT_WORKS_INTRO_MAX = 300;
export const HOW_IT_WORKS_STEP_TITLE_MAX = 80;
export const HOW_IT_WORKS_STEP_DESCRIPTION_MAX = 300;
export const HOW_IT_WORKS_STEPS_MAX = 6;
export const SERVICE_AREA_HEADING_MAX = 120;
export const SERVICE_AREA_INTRO_MAX = 300;
export const FEATURED_KICKER_MAX = 60;
export const FEATURED_TITLE_MAX = 120;
export const FEATURED_DESCRIPTION_MAX = 200;

/** Bounded image URL — an absolute http(s) URL. Required form. */
const requiredImageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
    message: "Image URL must be an http(s) link.",
  });

/** Optional, bounded image URL. Must be an absolute http(s) URL when present. */
const imageUrlSchema = requiredImageUrlSchema.optional();

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

/**
 * trust settings: up to 3 curated badges, each a {title, description}. When
 * `badges` is absent the trust strip falls back to today's
 * getContentSettings().trustBadges / vertical defaults.
 */
export const trustSettingsSchema = z.object({
  badges: z
    .array(
      z.object({
        title: z.string().trim().max(TRUST_TITLE_MAX),
        description: z.string().trim().max(TRUST_DESCRIPTION_MAX),
      })
    )
    .max(TRUST_BADGES_MAX)
    .optional(),
});

/**
 * testimonials settings: a bounded list of {name, text, rating?}. Rating is an
 * optional 1–5 integer. Absent `items` → fall back to today's
 * getContentSettings().testimonials.
 */
export const testimonialsSettingsSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().max(TESTIMONIAL_NAME_MAX),
        text: z.string().trim().max(TESTIMONIAL_TEXT_MAX),
        rating: z.number().int().min(1).max(5).optional(),
      })
    )
    .max(TESTIMONIALS_MAX)
    .optional(),
});

/**
 * faq settings: a bounded list of {question, answer}. Absent `items` → fall
 * back to today's faqItems (custom_faq / i18n defaults) passed as customFaqs.
 */
export const faqSettingsSchema = z.object({
  items: z
    .array(
      z.object({
        question: z.string().trim().max(FAQ_QUESTION_MAX),
        answer: z.string().trim().max(FAQ_ANSWER_MAX),
      })
    )
    .max(FAQ_ITEMS_MAX)
    .optional(),
});

/**
 * custom-rich settings: an operator-authored PLAIN-text block (heading + body).
 * NO HTML/markdown — the component renders it as plain text with preserved line
 * breaks. Both optional; the component renders null when neither is present.
 */
export const customRichSettingsSchema = z.object({
  heading: z.string().trim().max(CUSTOM_RICH_HEADING_MAX).optional(),
  body: z.string().trim().max(CUSTOM_RICH_BODY_MAX).optional(),
});

/**
 * custom-image settings: a single operator-uploaded image with optional alt +
 * caption. `imageUrl` is optional (an added-but-not-yet-filled section); the
 * component renders null when no imageUrl is present.
 */
export const customImageSettingsSchema = z.object({
  imageUrl: imageUrlSchema,
  alt: z.string().trim().max(CUSTOM_IMAGE_ALT_MAX).optional(),
  caption: z.string().trim().max(CUSTOM_IMAGE_CAPTION_MAX).optional(),
});

/**
 * custom-gallery settings: a bounded list (max 12) of {imageUrl, alt?}. Each
 * item REQUIRES a valid imageUrl (an item without one is dropped by the editor
 * before save). Absent/empty `images` → the component renders null.
 */
export const customGallerySettingsSchema = z.object({
  images: z
    .array(
      z.object({
        imageUrl: requiredImageUrlSchema,
        alt: z.string().trim().max(CUSTOM_GALLERY_ALT_MAX).optional(),
      })
    )
    .max(CUSTOM_GALLERY_IMAGES_MAX)
    .optional(),
});

/**
 * closing settings: an editorial CTA. `heading` overrides the two-part display
 * statement (rendered as a single plain line when present); `body` adds an
 * optional supporting paragraph (absent → no paragraph, today's markup);
 * `buttonLabel` overrides the ghost-button text. All optional → byte-for-byte.
 */
export const closingSettingsSchema = z.object({
  heading: z.string().trim().max(CLOSING_HEADING_MAX).optional(),
  body: z.string().trim().max(CLOSING_BODY_MAX).optional(),
  buttonLabel: z.string().trim().max(CLOSING_BUTTON_LABEL_MAX).optional(),
});

/**
 * how-it-works settings: `heading` + `intro` overrides for the section head, plus
 * an optional bounded `steps` list. Absent fields fall back to today's i18n copy.
 */
export const howItWorksSettingsSchema = z.object({
  heading: z.string().trim().max(HOW_IT_WORKS_HEADING_MAX).optional(),
  intro: z.string().trim().max(HOW_IT_WORKS_INTRO_MAX).optional(),
  steps: z
    .array(
      z.object({
        title: z.string().trim().max(HOW_IT_WORKS_STEP_TITLE_MAX),
        description: z.string().trim().max(HOW_IT_WORKS_STEP_DESCRIPTION_MAX),
      })
    )
    .max(HOW_IT_WORKS_STEPS_MAX)
    .optional(),
});

/**
 * service-area settings: `heading` + optional `intro` overrides for the coverage
 * section head. Absent → today's i18n copy.
 */
export const serviceAreaSettingsSchema = z.object({
  heading: z.string().trim().max(SERVICE_AREA_HEADING_MAX).optional(),
  intro: z.string().trim().max(SERVICE_AREA_INTRO_MAX).optional(),
});

/**
 * featured settings: kicker / title / description overrides for the popular-
 * rentals section head. Absent → today's i18n copy (m.storefront.popularRentals).
 */
export const featuredSettingsSchema = z.object({
  kicker: z.string().trim().max(FEATURED_KICKER_MAX).optional(),
  title: z.string().trim().max(FEATURED_TITLE_MAX).optional(),
  description: z.string().trim().max(FEATURED_DESCRIPTION_MAX).optional(),
});

export type HeroSettings = z.infer<typeof heroSettingsSchema>;
export type AboutSettings = z.infer<typeof aboutSettingsSchema>;
export type TrustSettings = z.infer<typeof trustSettingsSchema>;
export type TestimonialsSettings = z.infer<typeof testimonialsSettingsSchema>;
export type FaqSettings = z.infer<typeof faqSettingsSchema>;
export type CustomRichSettings = z.infer<typeof customRichSettingsSchema>;
export type CustomImageSettings = z.infer<typeof customImageSettingsSchema>;
export type CustomGallerySettings = z.infer<typeof customGallerySettingsSchema>;
export type ClosingSettings = z.infer<typeof closingSettingsSchema>;
export type HowItWorksSettings = z.infer<typeof howItWorksSettingsSchema>;
export type ServiceAreaSettings = z.infer<typeof serviceAreaSettingsSchema>;
export type FeaturedSettings = z.infer<typeof featuredSettingsSchema>;

/**
 * Map of section type → the Zod schema validating that type's `settings`. Only
 * the editable PR-1c types are listed; types absent from this map carry no
 * validated content settings yet (their `settings` is ignored on render).
 */
export const SECTION_CONTENT_SCHEMAS = {
  hero: heroSettingsSchema,
  about: aboutSettingsSchema,
  trust: trustSettingsSchema,
  testimonials: testimonialsSettingsSchema,
  faq: faqSettingsSchema,
  "custom-rich": customRichSettingsSchema,
  "custom-image": customImageSettingsSchema,
  "custom-gallery": customGallerySettingsSchema,
  closing: closingSettingsSchema,
  "how-it-works": howItWorksSettingsSchema,
  "service-area": serviceAreaSettingsSchema,
  featured: featuredSettingsSchema,
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

/** Defensive parse against the trust schema ({} on absent/malformed). */
export function parseTrustSettings(settings: unknown): TrustSettings {
  const parsed = trustSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : {};
}

/** Defensive parse against the testimonials schema ({} on absent/malformed). */
export function parseTestimonialsSettings(
  settings: unknown
): TestimonialsSettings {
  const parsed = testimonialsSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : {};
}

/** Defensive parse against the faq schema ({} on absent/malformed). */
export function parseFaqSettings(settings: unknown): FaqSettings {
  const parsed = faqSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : {};
}

/** Defensive parse against the custom-rich schema ({} on absent/malformed). */
export function parseCustomRichSettings(settings: unknown): CustomRichSettings {
  const parsed = customRichSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : {};
}

/** Defensive parse against the custom-image schema ({} on absent/malformed). */
export function parseCustomImageSettings(
  settings: unknown
): CustomImageSettings {
  const parsed = customImageSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : {};
}

/** Defensive parse against the custom-gallery schema ({} on absent/malformed). */
export function parseCustomGallerySettings(
  settings: unknown
): CustomGallerySettings {
  const parsed = customGallerySettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : {};
}

/** Defensive parse against the closing schema ({} on absent/malformed). */
export function parseClosingSettings(settings: unknown): ClosingSettings {
  const parsed = closingSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : {};
}

/** Defensive parse against the how-it-works schema ({} on absent/malformed). */
export function parseHowItWorksSettings(settings: unknown): HowItWorksSettings {
  const parsed = howItWorksSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : {};
}

/** Defensive parse against the service-area schema ({} on absent/malformed). */
export function parseServiceAreaSettings(
  settings: unknown
): ServiceAreaSettings {
  const parsed = serviceAreaSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : {};
}

/** Defensive parse against the featured schema ({} on absent/malformed). */
export function parseFeaturedSettings(settings: unknown): FeaturedSettings {
  const parsed = featuredSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : {};
}

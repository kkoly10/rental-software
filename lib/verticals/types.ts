import type { Locale } from "../i18n/config.ts";

/**
 * VerticalConfig — declarative metadata for a rental vertical.
 *
 * A vertical is a thin composition: it declares which capabilities
 * its products use, supplies localized labels, lists seed categories
 * for new orgs picking this vertical at signup, and supplies the
 * marketing-page content / image asset paths.
 *
 * Verticals are NOT classes with methods. All behavior lives in the
 * referenced capabilities (or in shared infrastructure like delivery
 * routing / orders / payments). This is the property that lets us
 * add a new vertical with a TS file + images, no new logic.
 *
 * Design doc: docs/architecture/multi-vertical-capabilities.md
 */

export type VerticalImageSlugs = {
  /** Hero side image, portrait, ~540×600. Required. */
  hero: string;
  /** Crew at work — used in the delivery/setup feature row. */
  crew?: string;
  /** Inventory / warehouse shot. */
  inventory?: string;
  /** Event-in-progress transition banner. */
  transitionBanner?: string;
  /** Customer phone screenshot — often vertical-agnostic. */
  customerPhone?: string;
};

export type VerticalMarketing = {
  /** URL slug under /. e.g. "inflatable-rental-software" */
  landingPageSlug: string;
  /** SEO title for the /<vertical> landing page. */
  seoTitle: string;
  /** SEO meta description. */
  seoDescription: string;
  /** H1 above the fold on the dedicated landing page. */
  heroHeadline: string;
  /** Hero supporting copy — 1-2 sentences. */
  heroSubhead: string;
  /** Eyebrow text above the H1 (small uppercase). */
  heroKicker: string;
  /**
   * 4–6 value props rendered as a feature grid below the hero.
   * Kept English-only in Phase 2b; locale fallback can wrap this
   * later without breaking the type shape.
   */
  features: ReadonlyArray<{ title: string; body: string }>;
};

export type VerticalConfig = {
  /** Stable slug used in DB rows + registry lookup. e.g. "inflatable" */
  slug: string;
  /** Display label per locale; en is required (the source-of-truth locale). */
  label: Partial<Record<Locale, string>> & { en: string };
  /**
   * Slugs of capabilities this vertical's products use by default.
   * Validated against the capability registry at boot.
   */
  capabilities: string[];
  /** Default category names seeded when an org picks this vertical at signup. */
  defaultCategorySeeds: string[];
  /** Marketing-page configuration. */
  marketing: VerticalMarketing;
  /** Image asset paths (typically under /public/). */
  imageSlugs: VerticalImageSlugs;
};

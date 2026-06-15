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

/**
 * Per-vertical booking/cancellation policy defaults. One uniform
 * policy across verticals either over-promises (a tent operator
 * can't restock a cancelled 30-day build) or over-penalizes (a
 * bouncer can re-rent with a day's notice). Org-level settings may
 * override these later; the registry values are the launch defaults.
 */
export type VerticalPolicies = {
  /**
   * Days before the event inside which a cancellation forfeits
   * `forfeitPct` of the paid deposit. Cancelling EARLIER than this
   * window refunds the deposit in full.
   */
  refundWindowDays: number;
  /** Percent (0-100) of the paid deposit forfeited when cancelling
   *  inside the refund window. 0 = always fully refundable. */
  forfeitPct: number;
  /**
   * Vertical floor for booking lead time, in hours. The effective
   * lead time at checkout is max(org policy, this) — an org can be
   * stricter than the vertical, never looser.
   */
  minLeadTimeHours: number;
};

/**
 * Per-vertical defaults consumed by the editorial storefront. Sets
 * the default hero photo, headline (split for italic accent), lede,
 * trust-band statements, and browse-by-occasion tile presets when an
 * operator hasn't customized any of them. Operators continue to win
 * via `organizations.settings.{heroImageUrl, heroHeadline, websiteMessage}`
 * and `content_settings.{trustBadges, browseTiles}`.
 */
export type VerticalStorefrontDefaults = {
  /** Absolute path under /public for the hero photograph. */
  heroImagePath: string;
  /** Lead clause of the H1 (renders before the italic accent). */
  headlineLead: string;
  /** Italic accent at the end of the H1. Wrapped in <em>. */
  headlineItalic: string;
  /** One-sentence supporting copy. {area} is interpolated with the operator's
   *  service-area label at render time (falls back to "your area" when empty). */
  lede: string;
  /** Short uppercase label used in the header tagline. e.g. "Party rentals" */
  taglineLabel: string;
  /** Three trust pillars (kicker + statement). {area} interpolation supported. */
  trustBadges: ReadonlyArray<{ kicker: string; statement: string }>;
  /** Three browse-by-occasion tile presets. */
  vibeTiles: ReadonlyArray<{
    kicker: string;
    label: string;
    /** Image path under /public; tile component will render at 4:5 aspect. */
    imagePath: string;
    /** Filter href on the catalog index, e.g. "/inventory?category=combos". */
    href: string;
  }>;
};

export type VerticalConfig = {
  /** Stable slug used in DB rows + registry lookup. e.g. "inflatable" */
  slug: string;
  /**
   * Setup-only verticals (e.g. "other" / general rentals) appear in the
   * signup + onboarding pickers and are valid org business types, but
   * are excluded from every marketing surface — no /[vertical] landing
   * page, no sitemap entry, no footer / sibling links. Their `marketing`
   * + `imageSlugs` blocks satisfy the type but are never rendered.
   * Defaults to false/undefined (a normal marketed vertical).
   */
  setupOnly?: boolean;
  /** Display label per locale; en is required (the source-of-truth locale). */
  label: Partial<Record<Locale, string>> & { en: string };
  /**
   * Slugs of capabilities this vertical's products use by default.
   * Validated against the capability registry at boot.
   */
  capabilities: string[];
  /** Default category names seeded when an org picks this vertical at signup. */
  defaultCategorySeeds: string[];
  /** Booking/cancellation policy defaults — required so adding a
   *  vertical forces an explicit policy decision. */
  policies: VerticalPolicies;
  /** Marketing-page configuration. */
  marketing: VerticalMarketing;
  /** Image asset paths (typically under /public/). */
  imageSlugs: VerticalImageSlugs;
  /** Editorial storefront defaults. Optional during the migration window
   *  — verticals without it fall back to the inflatable defaults. */
  storefrontDefaults?: VerticalStorefrontDefaults;
  /**
   * Operator-side money defaults pre-filled (and editable) in the
   * onboarding wizard. Required so adding a vertical forces an explicit
   * decision — there is no sensible one-size default across a $40
   * popcorn machine and a $4,000 tent install. depositPercentage seeds
   * organizations.settings.deposit_percentage; deliveryFee +
   * orderMinimum seed the primary service area.
   */
  operatorDefaults: VerticalOperatorDefaults;
};

export type VerticalOperatorDefaults = {
  /** Percent of order total held to reserve, 0-100. */
  depositPercentage: number;
  /** Default order minimum in whole dollars. */
  orderMinimum: number;
  /** Default round-trip delivery fee in whole dollars. */
  deliveryFee: number;
};

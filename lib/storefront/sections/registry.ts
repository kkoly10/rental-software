/**
 * Storefront section registry — the CODE-SIDE source of truth for which section
 * types exist on the storefront home page and their ordering/visibility
 * metadata. See docs/saas/storefront-builder-spec.md §2.
 *
 * PR-1a scope: this is metadata only. The day-one section types are the EXISTING
 * party-classic sections re-expressed as registry entries, in today's exact
 * rendering order. The render wiring in app/page.tsx maps each `type` to the
 * SAME, UNCHANGED section component/markup it uses today — the registry does not
 * carry a renderer yet. Settings schemas, blocks, presets, and tier-gating
 * arrive with the editor in later PRs.
 *
 * This module is dependency-light (no server-only imports) so it stays
 * unit-testable and importable from both the RSC render path and (later) the
 * editor + the default-order synthesizer in ../page-document.ts.
 */

export type SectionType =
  | "hero"
  | "trust"
  | "press"
  | "category-grid"
  | "browse-tiles"
  | "featured"
  | "how-it-works"
  | "testimonials"
  | "service-area"
  | "about"
  | "faq"
  | "closing"
  // PR-1e: operator-addable CUSTOM section types. Unlike the day-one types these
  // are never seeded by the synthesizer — they only ever exist because an
  // operator ADDED them to a document. They carry their own content settings
  // (see content-schemas.ts) and render via dedicated party-classic components.
  | "custom-rich"
  | "custom-image"
  | "custom-gallery";

export type SectionDef = {
  /** Stable type key — maps to a render branch and (later) a settings schema. */
  type: SectionType;
  /** Operator-facing label for the editor section picker (later PRs). */
  label: string;
  /**
   * The legacy `content_settings.section_visibility` key that gated this section
   * today, if any. Used by the default-order synthesizer to map today's
   * show/hide booleans onto `disabled`. Undefined = the section had no explicit
   * visibility toggle (it self-gated on data, e.g. press/featured/service-area).
   */
  visibilityKey?: string;
  /**
   * Structural sections that must always be present in the document order and
   * cannot be removed by the operator (hero, closing).
   */
  alwaysPresent?: boolean;
  /**
   * Sections that exist in the default order but ship hidden (today's
   * section_visibility default of false): testimonials, about.
   */
  defaultDisabled?: boolean;
  /**
   * Whether the operator can ADD this type via the section picker (later PRs).
   * The day-one types are seeded from the synthesized default, not added; only
   * future curated types (custom-rich, custom-gallery) will be addable.
   */
  addable?: boolean;
};

/**
 * The day-one section registry, declared in today's exact render order. The
 * array order is itself meaningful: it is the canonical default sequence the
 * synthesizer walks (see synthesizeDefaultOrder).
 */
export const SECTION_REGISTRY: Record<SectionType, SectionDef> = {
  hero: { type: "hero", label: "Hero", alwaysPresent: true },
  trust: { type: "trust", label: "Trust badges", visibilityKey: "trust_bar" },
  press: { type: "press", label: "Press row" },
  "category-grid": {
    type: "category-grid",
    label: "Shop by category",
    visibilityKey: "category_grid",
  },
  "browse-tiles": {
    type: "browse-tiles",
    label: "Browse by occasion",
    visibilityKey: "category_grid",
  },
  featured: { type: "featured", label: "Featured rentals" },
  "how-it-works": {
    type: "how-it-works",
    label: "How it works",
    visibilityKey: "how_it_works",
  },
  testimonials: {
    type: "testimonials",
    label: "Testimonials",
    visibilityKey: "testimonials",
    defaultDisabled: true,
  },
  "service-area": { type: "service-area", label: "Service area" },
  about: {
    type: "about",
    label: "About",
    visibilityKey: "about_section",
    defaultDisabled: true,
  },
  faq: { type: "faq", label: "FAQ", visibilityKey: "faq_section" },
  closing: { type: "closing", label: "Closing", alwaysPresent: true },
  // PR-1e custom types — addable via the section picker. No tier field: the
  // whole builder is already Pro-gated (checkFeatureAccess("storefront_builder")),
  // so every builder user can add these.
  "custom-rich": { type: "custom-rich", label: "Text block", addable: true },
  "custom-image": { type: "custom-image", label: "Image", addable: true },
  "custom-gallery": {
    type: "custom-gallery",
    label: "Image gallery",
    addable: true,
  },
};

/**
 * The canonical default ordering of section types, matching today's
 * app/page.tsx render sequence exactly.
 */
export const DEFAULT_SECTION_ORDER: SectionType[] = [
  "hero",
  "trust",
  "press",
  "category-grid",
  "browse-tiles",
  "featured",
  "how-it-works",
  "testimonials",
  "service-area",
  "about",
  "faq",
  "closing",
];

/** Whether a string is a known, renderable section type. */
export function isKnownSectionType(type: string): type is SectionType {
  return Object.prototype.hasOwnProperty.call(SECTION_REGISTRY, type);
}

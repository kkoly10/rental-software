import { z } from "zod";
import {
  DEFAULT_SECTION_ORDER,
  SECTION_REGISTRY,
  type SectionType,
} from "./sections/registry.ts";

/**
 * The storefront page document SHAPE + pure helpers — split out from
 * page-document.ts (the server reader) so the Zod schema and the
 * default-order synthesizer have NO server-only dependencies and stay
 * unit-testable under `node --test` (mirrors the storefront-tokens-schema.ts /
 * storefront-page.ts split). See docs/saas/storefront-builder-spec.md §2, §7.
 *
 * The document lives in the SAME storefront_pages.{published,draft} JSON column
 * as the theme tokens (read by getStorefrontTokens), alongside an optional
 * `theme` key.
 */

export type SectionRecord = {
  type: string;
  disabled?: boolean;
  settings?: Record<string, unknown>;
};

export type StorefrontPageDocument = {
  schemaVersion: number;
  order: string[];
  sections: Record<string, SectionRecord>;
  theme?: unknown;
  /**
   * Optional per-tenant top-nav LABEL overrides (PR-2e): a map of nav key →
   * custom label string. Keys are the stable nav identities the header tags
   * with `data-st-nav-key` (catalog, how_it_works, service_area, order_status,
   * contact, book_now). Absent / empty entries fall back to the default label,
   * so an existing document with no `nav` renders byte-for-byte as before.
   */
  nav?: Record<string, string>;
};

const sectionRecordSchema = z.object({
  type: z.string(),
  disabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for the page document. `order` is REQUIRED and must be an array —
 * its absence is the signal for "not built yet" (the reader maps that to null).
 * `theme` is passthrough/unknown here; it's validated separately by the token
 * reader with themeTokensSchema.
 */
export const storefrontPageDocumentSchema = z.object({
  schemaVersion: z.number(),
  order: z.array(z.string()),
  sections: z.record(sectionRecordSchema),
  theme: z.unknown().optional(),
  // Optional nav label overrides (key → custom label). Kept loose here (a plain
  // string map); parseBuilderDocument trims/caps values and drops unknown keys
  // defensively on the publish path. Optional so existing docs stay valid.
  nav: z.record(z.string()).optional(),
});

export type SynthesizeDefaultOrderInput = {
  /** Today's content_settings.section_visibility map. */
  sectionVisibility: Record<string, boolean>;
  /** Whether the tenant has any featured products (featured.length > 0). */
  hasFeatured: boolean;
  /** Whether the tenant has any geocoded service areas (areas.length > 0). */
  hasServiceAreas: boolean;
};

export type SynthesizedSection = {
  id: string;
  type: SectionType;
  disabled: boolean;
};

/**
 * PURE helper (no DB, unit-testable) that, given today's gating inputs, returns
 * the default ordered list of sections matching app/page.tsx's EXACT current
 * sequence and visibility. The builder (PR-1b, §7) uses this to seed a page
 * document so first publish is byte-for-byte what the org renders today.
 *
 * Semantics mirror today's gating precisely:
 *  - hero, closing: always present (alwaysPresent).
 *  - trust/category-grid/browse-tiles/how-it-works/about/faq: gated by their
 *    visibilityKey with the `!== false` convention (present-and-enabled unless
 *    explicitly false). about ships hidden by default.
 *  - testimonials: gated by truthiness of vis.testimonials (default off).
 *  - press: always included (component self-gates on configured logos), no
 *    visibility key.
 *  - featured: included only when hasFeatured (today: `featured.length > 0`).
 *  - service-area: included only when hasServiceAreas (today the component
 *    returns null with no areas) AND vis.service_area_map !== false.
 *
 * IDs are stable, deterministic `sec_<type>` keys (sufficient for the day-one
 * one-instance-per-type default; opaque generated IDs arrive with add/remove).
 */
export function synthesizeDefaultOrder(
  input: SynthesizeDefaultOrderInput
): SynthesizedSection[] {
  const { sectionVisibility: vis, hasFeatured, hasServiceAreas } = input;
  const result: SynthesizedSection[] = [];

  for (const type of DEFAULT_SECTION_ORDER) {
    const def = SECTION_REGISTRY[type];

    // Data-gated sections are dropped entirely when their data is absent,
    // matching today's "component returns null" / "featured.length > 0" gating.
    if (type === "featured" && !hasFeatured) continue;
    if (type === "service-area") {
      if (!hasServiceAreas) continue;
      if (vis.service_area_map === false) continue;
    }

    let disabled = false;
    if (def.visibilityKey && type !== "service-area") {
      if (type === "testimonials") {
        // Truthy-gated today (vis.testimonials, default off).
        disabled = !vis[def.visibilityKey];
      } else {
        // `!== false` convention: present unless explicitly turned off.
        disabled = vis[def.visibilityKey] === false;
      }
    }

    result.push({ id: `sec_${type}`, type, disabled });
  }

  return result;
}

import "server-only";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import {
  resolveEditorTokens,
  DEFAULT_THEME_TOKENS,
} from "@/lib/data/storefront-token-defaults";
import { storefrontPageDocumentSchema } from "@/lib/storefront/page-document-schema";
import {
  buildDocumentFromSynthesized,
  normalizeExistingDocument,
} from "@/lib/storefront/builder-document";
import { synthesizeDefaultOrder } from "@/lib/storefront/page-document-schema";
import type { StorefrontPageDocument } from "@/lib/storefront/page-document-schema";

/**
 * Builder load (PR-1b). Resolves the operator's org from the AUTHENTICATED
 * session (getOrgContext) — NOT the hostname reader (getPublicOrgId), which
 * wouldn't resolve the operator's org on the dashboard host. With the org id it:
 *
 *  1. Reads the org's storefront_pages row (draft preferred, else published).
 *     If it has a valid `order`, that document is the starting state.
 *  2. Otherwise SYNTHESIZES a starting document from the operator's CURRENT
 *     settings (section_visibility) + whether they have featured products /
 *     active service areas — mirroring app/dashboard/website's content reads but
 *     scoped by the auth-resolved org id. Synthesizing does NOT persist; only
 *     Save/Publish writes.
 *  3. Resolves the theme tokens (draft.theme → published.theme → defaults) and
 *     attaches them to the document, so the Styles tab always edits a valid theme.
 */

// Mirror lib/data/content-settings.ts defaults so the builder seed matches what
// the org renders today before any builder edit.
const DEFAULT_VISIBILITY: Record<string, boolean> = {
  trust_bar: true,
  category_grid: true,
  how_it_works: true,
  faq_section: true,
  about_section: false,
  testimonials: false,
  service_area_map: true,
};

export type BuilderLoadResult = {
  /** The starting document (existing or synthesized), theme attached. */
  document: StorefrontPageDocument;
  /** True when there was no persisted document and we synthesized the seed. */
  synthesized: boolean;
};

/** Demo / no-env fallback: synthesize from defaults so the UI still renders. */
function fallbackResult(): BuilderLoadResult {
  const sections = synthesizeDefaultOrder({
    sectionVisibility: DEFAULT_VISIBILITY,
    hasFeatured: false,
    hasServiceAreas: false,
  });
  return {
    document: buildDocumentFromSynthesized(sections, DEFAULT_THEME_TOKENS),
    synthesized: true,
  };
}

export async function loadBuilderDocument(): Promise<BuilderLoadResult> {
  if (!hasSupabaseEnv()) return fallbackResult();

  const ctx = await getOrgContext();
  if (!ctx) return fallbackResult();

  const supabase = await createSupabaseServerClient();

  // 1) Existing storefront_pages row (auth-scoped by the resolved org id).
  const { data: pageRow } = await supabase
    .from("storefront_pages")
    .select("draft, published")
    .eq("organization_id", ctx.organizationId)
    .eq("page_key", "home")
    .maybeSingle();

  const draft = (pageRow?.draft as Record<string, unknown> | null) ?? null;
  const published =
    (pageRow?.published as Record<string, unknown> | null) ?? null;

  const theme = resolveEditorTokens(draft?.theme, published?.theme);

  // Prefer a valid draft document, else a valid published one.
  for (const candidate of [draft, published]) {
    if (candidate && typeof candidate === "object") {
      const parsed = storefrontPageDocumentSchema.safeParse(candidate);
      if (parsed.success && parsed.data.order.length > 0) {
        return {
          document: normalizeExistingDocument(parsed.data, theme),
          synthesized: false,
        };
      }
    }
  }

  // 2) No usable document → synthesize from the operator's CURRENT settings.
  const [{ data: orgRow }, { count: featuredCount }, { count: areaCount }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("settings")
        .eq("id", ctx.organizationId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .eq("visibility", "public")
        .eq("is_active", true)
        .is("deleted_at", null),
      supabase
        .from("service_areas")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .eq("is_active", true)
        .is("deleted_at", null),
    ]);

  const settings = (orgRow?.settings as Record<string, unknown> | null) ?? {};
  const sectionVisibility: Record<string, boolean> = {
    ...DEFAULT_VISIBILITY,
    ...((settings.section_visibility as Record<string, boolean>) ?? {}),
  };

  const sections = synthesizeDefaultOrder({
    sectionVisibility,
    hasFeatured: (featuredCount ?? 0) > 0,
    hasServiceAreas: (areaCount ?? 0) > 0,
  });

  return {
    document: buildDocumentFromSynthesized(sections, theme),
    synthesized: true,
  };
}

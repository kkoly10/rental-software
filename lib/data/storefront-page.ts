import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import {
  themeTokensSchema,
  type ThemeTokens,
} from "@/lib/data/storefront-tokens-schema";

/**
 * Storefront theme tokens — the BOUNDED, W3C-token-shaped set the editorial
 * builder (G2) lets operators tune within rails. See
 * docs/saas/storefront-builder-spec.md §3.
 *
 * The schema itself lives in ./storefront-tokens-schema.ts (zod-only, so it's
 * unit-testable without server deps); it's re-exported here so existing
 * consumers keep importing from "@/lib/data/storefront-page".
 *
 * The reader below parses the `theme` out of the published page document with
 * that schema and is purely defensive — it returns null on ANY error so that,
 * until the table exists and an org publishes tokens, the storefront renders
 * byte-for-byte as today.
 */
export {
  themeTokensSchema,
  CURATED_FONTS,
  type ThemeTokens,
} from "@/lib/data/storefront-tokens-schema";

/**
 * Read the published storefront theme tokens for the current public tenant.
 *
 * DEFENSIVE BY DESIGN: returns null on ANY error, missing row, missing table,
 * missing service-role env, or parse/validation failure — it never throws.
 * This guarantees the storefront renders exactly as today until the table
 * exists and an org actually publishes valid tokens.
 *
 * Wrapped in React cache() — called from the root layout (style injector);
 * deduped per request alongside getBrandSettings.
 *
 * Uses the service-role admin client where available (same anon-RLS pattern as
 * getCatalogDetail / brand.ts): the public storefront runs anonymously and RLS
 * on storefront_pages is gated to org members, so the cookie-bound client
 * would return null for a perfectly valid published page. Org isolation is
 * enforced via .eq("organization_id", ...).
 */
export const getStorefrontTokens = cache(
  async (): Promise<ThemeTokens | null> => {
    try {
      if (!hasSupabaseEnv()) return null;

      const organizationId = await getPublicOrgId();
      if (!organizationId) return null;

      const supabase = hasSupabaseServiceRoleEnv()
        ? createSupabaseAdminClient()
        : await createSupabaseServerClient();

      const { data, error } = await supabase
        .from("storefront_pages")
        .select("published")
        .eq("organization_id", organizationId)
        .eq("page_key", "home")
        .maybeSingle();

      // Missing row, missing table (PostgREST error), or any DB error → null.
      if (error || !data) return null;

      const published = data.published as Record<string, unknown> | null;
      if (!published || typeof published !== "object") return null;

      // Tokens may live under `theme` or `tokens` in the page document.
      const raw =
        (published.theme as unknown) ?? (published.tokens as unknown) ?? null;
      if (!raw) return null;

      const parsed = themeTokensSchema.safeParse(raw);
      if (!parsed.success) return null;

      return parsed.data;
    } catch {
      // Never throw — any unexpected failure leaves the storefront on the
      // legacy brand vars.
      return null;
    }
  }
);

import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { storefrontPageDocumentSchema } from "@/lib/storefront/page-document-schema";
import type { StorefrontPageDocument } from "@/lib/storefront/page-document-schema";

/**
 * The storefront page document — the keyed-map + order-array shape the editorial
 * builder persists per tenant per page. See
 * docs/saas/storefront-builder-spec.md §2 and §7.
 *
 * The document lives in the SAME storefront_pages.{published,draft} JSON column
 * as the theme tokens (read by getStorefrontTokens), alongside an optional
 * `theme` key.
 *
 * This module is the SERVER reader (it pulls in supabase/env). The document
 * SHAPE (Zod schema, types) and the pure default-order synthesizer live in
 * ./page-document-schema.ts (zero server deps, so they're unit-testable under
 * `node --test`); they're re-exported here so existing consumers keep importing
 * from "@/lib/storefront/page-document".
 *
 * PR-1a wires a DORMANT, defensive READ path: the live storefront renders from
 * this document only when an org has actually published one with a non-empty
 * `order`. No org has today, so every storefront takes the unchanged legacy
 * render path. The reader NEVER throws — any error/missing/parse failure → null
 * → legacy render.
 */

export {
  storefrontPageDocumentSchema,
  synthesizeDefaultOrder,
  type SectionRecord,
  type StorefrontPageDocument,
  type SynthesizeDefaultOrderInput,
  type SynthesizedSection,
} from "@/lib/storefront/page-document-schema";

/**
 * Read the storefront page document for the current public tenant from the
 * requested scope ("published" for the live site, "draft" for the preview
 * route in a later PR).
 *
 * DEFENSIVE BY DESIGN — returns null on ANY of: no Supabase env, no resolved
 * org, no service-role env + RLS miss, missing row, missing table, DB error,
 * a non-object payload, a missing/empty `order` array, or a Zod parse failure.
 * It never throws. A null result means "render the legacy hardcoded sequence".
 *
 * An EMPTY `order` array is treated identically to a missing document (null):
 * a published doc with nothing to render is "not built yet", not "render
 * nothing".
 *
 * Uses the service-role admin client where available (same anon-RLS pattern as
 * getStorefrontTokens / getCatalogDetail): the public storefront runs
 * anonymously and RLS on storefront_pages is gated to org members, so the
 * cookie-bound client would return null for a perfectly valid published page.
 * Org isolation is enforced via .eq("organization_id", ...).
 *
 * Wrapped in React cache() so the render path can call it once per request.
 */
export const getStorefrontPageDocument = cache(
  async (
    scope: "published" | "draft"
  ): Promise<StorefrontPageDocument | null> => {
    try {
      if (!hasSupabaseEnv()) return null;

      const organizationId = await getPublicOrgId();
      if (!organizationId) return null;

      const supabase = hasSupabaseServiceRoleEnv()
        ? createSupabaseAdminClient()
        : await createSupabaseServerClient();

      const { data, error } = await supabase
        .from("storefront_pages")
        .select(scope)
        .eq("organization_id", organizationId)
        .eq("page_key", "home")
        .maybeSingle();

      // Missing row, missing table (PostgREST error), or any DB error → null.
      if (error || !data) return null;

      const raw = (data as Record<string, unknown>)[scope] as unknown;
      if (!raw || typeof raw !== "object") return null;

      const parsed = storefrontPageDocumentSchema.safeParse(raw);
      if (!parsed.success) return null;

      // Empty order = "not built yet" → null → legacy render.
      if (parsed.data.order.length === 0) return null;

      return parsed.data;
    } catch {
      // Never throw — any unexpected failure leaves the storefront on the
      // legacy hardcoded render path.
      return null;
    }
  }
);

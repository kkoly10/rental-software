"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { checkFeatureAccess } from "@/lib/stripe/gate";
import { themeTokensSchema } from "@/lib/data/storefront-tokens-schema";
import { checkPublishContrast } from "@/lib/data/storefront-token-defaults";
import { parseBuilderDocument } from "@/lib/storefront/builder-document";

export type StorefrontPageActionState = {
  ok: boolean;
  message: string;
};

const MAX_JSON_BYTES = 20_000;

/**
 * Shared guard for both storefront write actions: require auth, owner/admin
 * role (mirrors content-actions.ts readMergeWrite), AND re-check the Pro gate
 * server-side. The client gate is convenience only — never trust it.
 */
async function requireBuilderWriteAccess(): Promise<
  | {
      ok: true;
      orgId: string;
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    }
  | { ok: false; state: StorefrontPageActionState }
> {
  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, state: { ok: false, message: "Not authenticated." } };
  }

  const supabase = await createSupabaseServerClient();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin"].includes(membership?.role ?? "")) {
    return {
      ok: false,
      state: {
        ok: false,
        message: "Only owners and admins can edit the storefront design.",
      },
    };
  }

  // Re-check the Pro gate server-side (spec §5: gating enforced in two layers).
  const gate = await checkFeatureAccess("storefront_builder");
  if (!gate.allowed) {
    return {
      ok: false,
      state: {
        ok: false,
        message: gate.reason ?? "Storefront design requires the Pro plan.",
      },
    };
  }

  return { ok: true, orgId: ctx.organizationId, supabase };
}

/**
 * Parse + validate the tokens JSON posted from the editor against
 * themeTokensSchema. Rejects oversized or malformed payloads.
 */
function parseTokens(
  formData: FormData
):
  | { ok: true; tokens: import("@/lib/data/storefront-tokens-schema").ThemeTokens }
  | { ok: false; message: string } {
  const raw = String(formData.get("tokens_json") ?? "");
  if (!raw) return { ok: false, message: "Missing theme data." };
  if (raw.length > MAX_JSON_BYTES) {
    return { ok: false, message: "Theme payload too large." };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Invalid theme data." };
  }

  const parsed = themeTokensSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Theme settings are out of range.",
    };
  }
  return { ok: true, tokens: parsed.data };
}

/**
 * Save the current editor tokens as the DRAFT theme. Draft may have low text
 * contrast (the editor warns) — it is not the live site. Only publish enforces
 * the 4.5:1 rule.
 */
export async function saveStorefrontDraft(
  _prev: StorefrontPageActionState,
  formData: FormData
): Promise<StorefrontPageActionState> {
  const parsed = parseTokens(formData);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: draft would be saved." };
  }

  const auth = await requireBuilderWriteAccess();
  if (!auth.ok) return auth.state;

  const { error } = await auth.supabase.from("storefront_pages").upsert(
    {
      organization_id: auth.orgId,
      page_key: "home",
      draft: { theme: parsed.tokens },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,page_key" }
  );
  if (error) {
    return { ok: false, message: "Couldn't save your draft. Please try again." };
  }

  revalidatePath("/dashboard/website/builder");
  return { ok: true, message: "Draft saved." };
}

/**
 * Publish the editor tokens to the LIVE storefront. Enforces the WCAG AA
 * contrast rule on body-text-vs-background (spec §3). On success writes both
 * `published` (the live source of truth) and syncs `draft` to match, stamps
 * published_at, and revalidates the public layout + builder.
 */
export async function publishStorefront(
  _prev: StorefrontPageActionState,
  formData: FormData
): Promise<StorefrontPageActionState> {
  const parsed = parseTokens(formData);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const contrast = checkPublishContrast(parsed.tokens);
  if (!contrast.ok) {
    return {
      ok: false,
      message: `Can't publish: text on the background is only ${contrast.ratio}:1 contrast (WCAG AA needs 4.5:1). Darken the text or lighten the background.`,
    };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: theme would be published." };
  }

  const auth = await requireBuilderWriteAccess();
  if (!auth.ok) return auth.state;

  const theme = { theme: parsed.tokens };
  const { error } = await auth.supabase.from("storefront_pages").upsert(
    {
      organization_id: auth.orgId,
      page_key: "home",
      // Publish is the live source of truth; keep the draft in lockstep so
      // re-opening the builder doesn't show stale draft vs published.
      draft: theme,
      published: theme,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,page_key" }
  );
  if (error) {
    return {
      ok: false,
      message: "Couldn't publish your theme. Please try again.",
    };
  }

  // The live storefront (root layout style injector) + the builder both read
  // storefront_pages — revalidate at layout level so every storefront subpage
  // picks up the new tokens.
  revalidatePath("/", "layout");
  revalidatePath("/dashboard/website/builder");
  return { ok: true, message: "Published. Your live storefront is updated." };
}

// ───────────────────────────────────────────────────────────────────────────
// PR-1b: document-based save/publish (the visible section builder).
//
// These persist the WHOLE page document — { schemaVersion, order, sections,
// theme } — not just the theme. One document, one write: the theme is embedded
// in the same object so the Styles tab (theme) and the Sections tab (order /
// disabled) can never clobber each other with separate write paths (spec §4).
// The token-only actions above remain for backward-compat; the builder uses
// these.
// ───────────────────────────────────────────────────────────────────────────

const MAX_DOCUMENT_BYTES = 100_000;

/**
 * Parse + validate the full builder document posted from the editor. Validates
 * the whole document against storefrontPageDocumentSchema AND the embedded theme
 * against themeTokensSchema (via parseBuilderDocument), and rejects oversized
 * payloads. Returns the normalized document (theme re-attached) on success.
 */
function parseDocument(
  formData: FormData
):
  | { ok: true; document: import("@/lib/storefront/page-document-schema").StorefrontPageDocument; tokens: import("@/lib/data/storefront-tokens-schema").ThemeTokens }
  | { ok: false; message: string } {
  const raw = String(formData.get("document_json") ?? "");
  if (!raw) return { ok: false, message: "Missing storefront layout data." };
  if (raw.length > MAX_DOCUMENT_BYTES) {
    return { ok: false, message: "Storefront layout payload too large." };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Invalid storefront layout data." };
  }

  const parsed = parseBuilderDocument(value);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  return { ok: true, document: parsed.value.document, tokens: parsed.value.theme };
}

/**
 * Save the builder document (order + sections + theme) as the DRAFT. Draft may
 * have low text contrast (the editor warns) — it is not the live site. Only
 * publish enforces the 4.5:1 rule.
 */
export async function saveStorefrontDocumentDraft(
  _prev: StorefrontPageActionState,
  formData: FormData
): Promise<StorefrontPageActionState> {
  const parsed = parseDocument(formData);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: draft would be saved." };
  }

  const auth = await requireBuilderWriteAccess();
  if (!auth.ok) return auth.state;

  const { error } = await auth.supabase.from("storefront_pages").upsert(
    {
      organization_id: auth.orgId,
      page_key: "home",
      draft: parsed.document,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,page_key" }
  );
  if (error) {
    return { ok: false, message: "Couldn't save your draft. Please try again." };
  }

  revalidatePath("/dashboard/website/builder");
  return { ok: true, message: "Draft saved." };
}

/**
 * Publish the builder document to the LIVE storefront. Enforces the WCAG AA
 * contrast rule on the embedded theme (spec §3), writes `published` (the live
 * source of truth) and syncs `draft` to match, stamps published_at, and
 * revalidates the public layout so the now document-driven storefront reflects
 * the new order / visibility / theme.
 */
export async function publishStorefrontDocument(
  _prev: StorefrontPageActionState,
  formData: FormData
): Promise<StorefrontPageActionState> {
  const parsed = parseDocument(formData);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const contrast = checkPublishContrast(parsed.tokens);
  if (!contrast.ok) {
    return {
      ok: false,
      message: `Can't publish: text on the background is only ${contrast.ratio}:1 contrast (WCAG AA needs 4.5:1). Darken the text or lighten the background.`,
    };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: storefront would be published." };
  }

  const auth = await requireBuilderWriteAccess();
  if (!auth.ok) return auth.state;

  const { error } = await auth.supabase.from("storefront_pages").upsert(
    {
      organization_id: auth.orgId,
      page_key: "home",
      // One document, written to both columns so re-opening the builder never
      // shows stale draft vs published. The embedded `theme` stays at the same
      // published.theme path getStorefrontTokens reads (backward-compat).
      draft: parsed.document,
      published: parsed.document,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,page_key" }
  );
  if (error) {
    return {
      ok: false,
      message: "Couldn't publish your storefront. Please try again.",
    };
  }

  // The live storefront now renders from this document (PR-1a). Revalidate at
  // layout level so every storefront subpage picks up the new layout + theme.
  revalidatePath("/", "layout");
  revalidatePath("/dashboard/website/builder");
  return { ok: true, message: "Published. Your live storefront is updated." };
}

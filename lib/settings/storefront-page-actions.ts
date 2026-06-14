"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { checkFeatureAccess } from "@/lib/stripe/gate";
import { themeTokensSchema } from "@/lib/data/storefront-tokens-schema";
import { checkPublishContrast } from "@/lib/data/storefront-token-defaults";

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

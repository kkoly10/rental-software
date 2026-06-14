// Relative imports (not the @/ alias) so this module — like
// storefront-tokens-schema.ts — is unit-testable with `node --test` directly,
// which doesn't resolve the tsconfig path alias.
import { contrastRatio } from "../utils/contrast.ts";
import {
  themeTokensSchema,
  type ThemeTokens,
} from "./storefront-tokens-schema.ts";

/**
 * Sensible default theme tokens for the builder when an org has no draft and no
 * published theme yet. These mirror the editorial theme's baseline `--st-*`
 * values (app/storefront-theme.css) so opening the builder for the first time
 * shows the storefront as it renders today, not a blank slate.
 *
 * Kept dependency-light (schema + contrast only) so it's unit-testable.
 */
export const DEFAULT_THEME_TOKENS: ThemeTokens = themeTokensSchema.parse({
  colors: {
    background: "#F7F4EE", // --st-bg (warm cream)
    surface: "#FFFFFF", // --st-card
    text: "#1A1A1A", // --st-ink
    textMuted: "#5C5651", // --st-muted
    primary: "#3F4A33", // --st-primary (deep olive, AA on cream)
    accent: "#3F4A33", // --st-accent collapses to primary by default
  },
  typography: {
    // Playfair Display is the curated serif standing in for the theme's
    // Fraunces display face; Inter is the neutral body default.
    headingFont: "Playfair Display",
    bodyFont: "Inter",
    baseSizePx: 16, // --st-text-16
    scaleRatio: 1.2,
  },
  radius: 4, // --st-radius-* baseline
});

/**
 * Resolve the tokens to seed the builder editor with. Preference order per the
 * spec: existing draft theme → published theme → baked-in defaults. Each
 * candidate is validated against the schema; an invalid/partial candidate is
 * skipped so a corrupt draft can never brick the editor.
 */
export function resolveEditorTokens(
  draftTheme: unknown,
  publishedTheme: unknown
): ThemeTokens {
  for (const candidate of [draftTheme, publishedTheme]) {
    if (candidate && typeof candidate === "object") {
      const parsed = themeTokensSchema.safeParse(candidate);
      if (parsed.success) return parsed.data;
    }
  }
  return DEFAULT_THEME_TOKENS;
}

/**
 * The publish-time contrast rule (spec §3: "reject < 4.5:1"). Body text on the
 * page background MUST clear WCAG AA (4.5:1) before an operator can ship — the
 * runtime injector auto-corrects as a safety net, but publish should not let
 * them ship unreadable body copy. Save-draft is allowed to warn but proceed.
 *
 * Returns the failing pair (if any) so the caller can build a clear message.
 */
export function checkPublishContrast(tokens: ThemeTokens): {
  ok: boolean;
  ratio: number;
} {
  const ratio = contrastRatio(tokens.colors.text, tokens.colors.background);
  return { ok: ratio >= 4.5, ratio: Math.round(ratio * 100) / 100 };
}

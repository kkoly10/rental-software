"use client";

import { BrandSettings } from "@/lib/data/brand";
import type { ThemeTokens } from "@/lib/data/storefront-page";
import { contrastRatio, relativeLuminance } from "@/lib/utils/contrast";

// The editorial theme paints --st-primary as text/links/borders on the cream
// page background. Keep this in sync with --st-bg in app/storefront-theme.css.
const ST_CREAM = "#F7F4EE";
// Editorial ink (--st-ink) — guaranteed AA fallback when even heavy darkening
// of the brand hue can't clear 4.5:1 on cream (e.g. a pure yellow brand).
const ST_INK = "#1A1A1A";

const GOOGLE_FONT_MAP: Record<string, string> = {
  "Plus Jakarta Sans": "Plus+Jakarta+Sans:wght@400;500;600;700;800",
  Sora: "Sora:wght@300;400;500;600;700;800",
  Inter: "Inter:wght@400;500;600;700",
  Poppins: "Poppins:wght@400;500;600;700",
  Montserrat: "Montserrat:wght@400;500;600;700",
  "Playfair Display": "Playfair+Display:wght@400;500;600;700",
  Roboto: "Roboto:wght@400;500;700",
};

/**
 * Darken a hex color by a given factor (0 = unchanged, 1 = black).
 */
function darkenHex(hex: string, factor: number): string {
  let cleaned = hex.replace("#", "");
  // Expand 3/4-digit shorthand (#abc -> #aabbcc) so fixed-offset slicing works.
  if (cleaned.length === 3 || cleaned.length === 4) {
    cleaned = cleaned.split("").map((c) => c + c).join("");
  }
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex;
  const d = (c: number) => Math.round(c * (1 - factor)).toString(16).padStart(2, "0");
  return `#${d(r)}${d(g)}${d(b)}`;
}

function isSafeHex(value: string | null | undefined): boolean {
  return !!value && /^#[0-9a-fA-F]{3,8}$/.test(value);
}

/**
 * Return a variant of `hex` that meets WCAG AA (4.5:1) as text on the cream
 * page background, preserving the brand hue where possible by progressively
 * darkening it. Falls back to editorial ink only if even near-black darkening
 * of the hue can't clear the threshold.
 *
 * This is the contrast safety net for the editorial (.st-*) theme: --st-primary
 * is used for small text, links, and borders on cream, so a mid-bright brand
 * color (e.g. #4aa3ff) would otherwise render below AA. The olive default
 * (#3F4A33) already passes, so existing operators are unaffected — this only
 * corrects custom brand colors that fail.
 */
function aaPrimaryOnCream(hex: string): string {
  if (contrastRatio(hex, ST_CREAM) >= 4.5) return hex;
  for (let factor = 0.1; factor <= 0.85; factor += 0.1) {
    const candidate = darkenHex(hex, factor);
    if (contrastRatio(candidate, ST_CREAM) >= 4.5) return candidate;
  }
  return ST_INK;
}

/**
 * AA contrast safety against an arbitrary background — used for token colors
 * where the operator chooses both the background and the foreground (the
 * legacy path only ever painted on the fixed cream). Progressively darkens
 * the foreground to clear 4.5:1 against the given bg, falling back to ink.
 */
function aaTextOn(hex: string, bg: string): string {
  if (contrastRatio(hex, bg) >= 4.5) return hex;
  for (let factor = 0.1; factor <= 0.85; factor += 0.1) {
    const candidate = darkenHex(hex, factor);
    if (contrastRatio(candidate, bg) >= 4.5) return candidate;
  }
  return ST_INK;
}

/**
 * Build the `--st-*` CSS variable declarations for a validated token set.
 *
 * These override the legacy brand-derived vars (the document tokens are the
 * new source of truth for the fields they cover, per the spec), so the caller
 * appends them AFTER the legacy declarations in the SAME scoped `:root` block.
 *
 * Token colors get the same on-background contrast safety net the legacy path
 * applies to --st-primary on cream, but validated against the token's OWN
 * background so a custom cream + custom primary pair still clears AA.
 */
function tokenCssVars(tokens: ThemeTokens): string[] {
  const vars: string[] = [];
  const { colors, typography, radius } = tokens;
  const bg = colors.background;

  // background -> --st-bg (+ --st-bg-alt fallback alias), surface -> --st-card
  vars.push(`--st-bg: ${bg};`);
  vars.push(`--st-bg-alt: ${bg};`);
  vars.push(`--st-card: ${colors.surface};`);

  // text -> --st-ink / --st-text (alias), text-muted -> --st-muted
  vars.push(`--st-ink: ${aaTextOn(colors.text, bg)};`);
  vars.push(`--st-text: var(--st-ink);`);
  vars.push(`--st-muted: ${colors.textMuted};`);

  // primary / accent — AA-corrected as text/links/borders on the token bg,
  // matching the legacy aaPrimaryOnCream treatment.
  vars.push(`--st-primary: ${aaTextOn(colors.primary, bg)};`);
  vars.push(`--st-accent: ${aaTextOn(colors.accent, bg)};`);

  // Fonts — curated names, mapped to the same family stacks the theme uses.
  vars.push(
    `--st-font-display: "${typography.headingFont}", "Fraunces", Georgia, serif;`
  );
  vars.push(
    `--st-font-body: "${typography.bodyFont}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;`
  );

  // Base body size — the theme reads --st-text-16 as the body font-size.
  vars.push(`--st-text-16: ${typography.baseSizePx}px;`);

  // Radius — override the editorial radius scale tokens consistently.
  vars.push(`--st-radius-2: ${radius}px;`);
  vars.push(`--st-radius-sm: ${radius}px;`);
  vars.push(`--st-radius-md: ${radius}px;`);
  vars.push(`--st-radius-lg: ${radius}px;`);

  return vars;
}

export function BrandStyleInjector({
  brand,
  tokens = null,
}: {
  brand: BrandSettings;
  tokens?: ThemeTokens | null;
}) {
  const hasCustomPrimary = isSafeHex(brand.primaryColor) && brand.primaryColor !== "#e8590c";
  const hasCustomAccent = isSafeHex(brand.accentColor) && brand.accentColor !== "#7c3aed";
  const hasCustomFont = brand.fontFamily && brand.fontFamily !== "System Default" && brand.fontFamily in GOOGLE_FONT_MAP;

  // No legacy brand customization AND no published tokens → emit nothing.
  // This preserves the exact byte-for-byte output (a bare `return null`) the
  // component had before tokens existed: when tokens is null/absent the
  // condition collapses to the original one and the early return is taken.
  if (!hasCustomPrimary && !hasCustomAccent && !hasCustomFont && !tokens) {
    return null;
  }

  const cssVars: string[] = [];
  let safetyOverrides = "";

  if (hasCustomPrimary) {
    const luminance = relativeLuminance(brand.primaryColor);

    // --primary stays the raw brand color (used as a fill behind cream text,
    // e.g. buttons, where the brand hue itself is correct). --st-primary is
    // the editorial token painted AS text/links/borders on the cream page, so
    // it must clear AA against cream — correct it independently.
    cssVars.push(`--primary: ${brand.primaryColor};`);
    cssVars.push(`--st-primary: ${aaPrimaryOnCream(brand.primaryColor)};`);

    if (luminance > 0.9) {
      // Extremely light — compute a darkened variant for text readability
      const safeTextColor = darkenHex(brand.primaryColor, 0.7);
      cssVars.push(`--primary-text: ${safeTextColor};`);
      const s = "body:not(:has(.sidebar-layout))";
      safetyOverrides = `
        ${s} .kicker, ${s} .public-logo, ${s} .nav-links a:hover,
        ${s} a:focus-visible, ${s} .faq-trigger:hover { color: var(--primary-text); }
        ${s} .primary-btn { background: var(--primary-text); }
        ${s} .primary-btn:hover { background: var(--primary-text); filter: brightness(0.85); }
      `;
    } else {
      cssVars.push(`--primary-text: ${brand.primaryColor};`);
    }
  }

  if (hasCustomAccent) {
    const luminance = relativeLuminance(brand.accentColor);

    if (luminance > 0.9) {
      const safeAccent = darkenHex(brand.accentColor, 0.6);
      cssVars.push(`--accent: ${safeAccent};`);
    } else {
      cssVars.push(`--accent: ${brand.accentColor};`);
    }
  }

  if (hasCustomFont) {
    cssVars.push(
      `--brand-font: "${brand.fontFamily}", "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif;`
    );
  }

  // Published theme tokens are the source of truth for the fields they cover.
  // Append them AFTER the legacy vars in the same scoped block so the later
  // declaration wins the cascade. When tokens is null this is a no-op and the
  // output is identical to the pre-tokens component.
  if (tokens) {
    cssVars.push(...tokenCssVars(tokens));
  }

  // Scope brand vars to pages that do NOT contain the dashboard shell
  // (.sidebar-layout is always present on every dashboard page).  This
  // prevents tenant brand colors from bleeding into the operator UI when
  // the dashboard is visited on the tenant's own subdomain/custom domain.
  const scope = ":root:not(:has(.sidebar-layout))";
  const bodyScope = "body:not(:has(.sidebar-layout))";

  const styleContent = `${scope} { ${cssVars.join(" ")} }${
    hasCustomFont ? ` ${bodyScope} { font-family: var(--brand-font); }` : ""
  }${safetyOverrides}`;

  const fontParam = hasCustomFont ? GOOGLE_FONT_MAP[brand.fontFamily] : null;

  // Token fonts come from the same curated GOOGLE_FONT_MAP. Load each unique
  // family (heading + body) so the --st-font-* overrides actually have the
  // webfont available.
  const tokenFontFamilies = tokens
    ? Array.from(
        new Set([tokens.typography.headingFont, tokens.typography.bodyFont])
      ).filter((f) => f in GOOGLE_FONT_MAP)
    : [];

  return (
    <>
      {fontParam && (
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${fontParam}&display=swap`}
        />
      )}
      {tokenFontFamilies.map((family) => (
        <link
          key={family}
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${GOOGLE_FONT_MAP[family]}&display=swap`}
        />
      ))}
      <style dangerouslySetInnerHTML={{ __html: styleContent }} />
    </>
  );
}

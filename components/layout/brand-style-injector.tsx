"use client";

import { BrandSettings } from "@/lib/data/brand";
import { relativeLuminance } from "@/lib/utils/contrast";

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

export function BrandStyleInjector({ brand }: { brand: BrandSettings }) {
  const hasCustomPrimary = isSafeHex(brand.primaryColor) && brand.primaryColor !== "#e8590c";
  const hasCustomAccent = isSafeHex(brand.accentColor) && brand.accentColor !== "#7c3aed";
  const hasCustomFont = brand.fontFamily && brand.fontFamily !== "System Default" && brand.fontFamily in GOOGLE_FONT_MAP;

  if (!hasCustomPrimary && !hasCustomAccent && !hasCustomFont) {
    return null;
  }

  const cssVars: string[] = [];
  let safetyOverrides = "";

  if (hasCustomPrimary) {
    const luminance = relativeLuminance(brand.primaryColor);

    if (luminance > 0.9) {
      // Extremely light — compute a darkened variant for text readability
      const safeTextColor = darkenHex(brand.primaryColor, 0.7);
      cssVars.push(`--primary: ${brand.primaryColor};`);
      cssVars.push(`--primary-text: ${safeTextColor};`);
      const s = "body:not(:has(.sidebar-layout))";
      safetyOverrides = `
        ${s} .kicker, ${s} .public-logo, ${s} .nav-links a:hover,
        ${s} a:focus-visible, ${s} .faq-trigger:hover { color: var(--primary-text); }
        ${s} .primary-btn { background: var(--primary-text); }
        ${s} .primary-btn:hover { background: var(--primary-text); filter: brightness(0.85); }
      `;
    } else {
      cssVars.push(`--primary: ${brand.primaryColor};`);
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

  return (
    <>
      {fontParam && (
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${fontParam}&display=swap`}
        />
      )}
      <style dangerouslySetInnerHTML={{ __html: styleContent }} />
    </>
  );
}

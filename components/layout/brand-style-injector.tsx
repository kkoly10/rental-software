"use client";

import { BrandSettings } from "@/lib/data/brand";
import { relativeLuminance } from "@/lib/utils/contrast";

const GOOGLE_FONT_MAP: Record<string, string> = {
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
  const cleaned = hex.replace("#", "");
  const r = Math.round(parseInt(cleaned.slice(0, 2), 16) * (1 - factor));
  const g = Math.round(parseInt(cleaned.slice(2, 4), 16) * (1 - factor));
  const b = Math.round(parseInt(cleaned.slice(4, 6), 16) * (1 - factor));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function BrandStyleInjector({ brand }: { brand: BrandSettings }) {
  const hasCustomPrimary = brand.primaryColor && brand.primaryColor !== "#1e5dcf";
  const hasCustomAccent = brand.accentColor && brand.accentColor !== "#20b486";
  const hasCustomFont = brand.fontFamily && brand.fontFamily !== "System Default";

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
      safetyOverrides = `
        .kicker, .public-logo, .nav-links a:hover, a:focus-visible,
        .faq-trigger:hover { color: var(--primary-text); }
        .primary-btn { background: var(--primary-text); }
        .primary-btn:hover { background: var(--primary-text); filter: brightness(0.85); }
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
      `--brand-font: "${brand.fontFamily}", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif;`
    );
  }

  const styleContent = `:root { ${cssVars.join(" ")} }${
    hasCustomFont ? ` body { font-family: var(--brand-font); }` : ""
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

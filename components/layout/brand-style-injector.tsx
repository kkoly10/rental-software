"use client";

import { BrandSettings } from "@/lib/data/brand";

const GOOGLE_FONT_MAP: Record<string, string> = {
  Inter: "Inter:wght@400;500;600;700",
  Poppins: "Poppins:wght@400;500;600;700",
  Montserrat: "Montserrat:wght@400;500;600;700",
  "Playfair Display": "Playfair+Display:wght@400;500;600;700",
  Roboto: "Roboto:wght@400;500;700",
};

export function BrandStyleInjector({ brand }: { brand: BrandSettings }) {
  const hasCustomPrimary = brand.primaryColor && brand.primaryColor !== "#1e5dcf";
  const hasCustomAccent = brand.accentColor && brand.accentColor !== "#20b486";
  const hasCustomFont = brand.fontFamily && brand.fontFamily !== "System Default";

  if (!hasCustomPrimary && !hasCustomAccent && !hasCustomFont) {
    return null;
  }

  const cssVars: string[] = [];
  if (hasCustomPrimary) {
    cssVars.push(`--primary: ${brand.primaryColor};`);
  }
  if (hasCustomAccent) {
    cssVars.push(`--accent: ${brand.accentColor};`);
  }
  if (hasCustomFont) {
    cssVars.push(
      `--brand-font: "${brand.fontFamily}", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif;`
    );
  }

  const styleContent = `:root { ${cssVars.join(" ")} }${
    hasCustomFont ? ` body { font-family: var(--brand-font); }` : ""
  }`;

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

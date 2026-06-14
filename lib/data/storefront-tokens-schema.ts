import { z } from "zod";

/**
 * Storefront theme tokens — the BOUNDED, W3C-token-shaped set the editorial
 * builder (G2) lets operators tune within rails. See
 * docs/saas/storefront-builder-spec.md §3.
 *
 * This module is intentionally dependency-light (zod only, no server-only
 * imports) so the schema can be unit-tested with `node --test` directly. The
 * server reader (getStorefrontTokens) lives in ./storefront-page.ts and
 * re-exports everything here, so consumers keep importing from
 * "@/lib/data/storefront-page".
 */

// Curated font allowlist — the EXACT keys of GOOGLE_FONT_MAP in
// components/layout/brand-style-injector.tsx. PR-A adds no new fonts; keeping
// this list in sync with the injector's map is intentional (both are the
// curated set). If the injector's map grows, mirror it here.
export const CURATED_FONTS = [
  "Plus Jakarta Sans",
  "Sora",
  "Inter",
  "Poppins",
  "Montserrat",
  "Playfair Display",
  "Roboto",
] as const;

// Hex color — #RGB / #RRGGBB / #RRGGBBAA, same shape the brand injector
// already accepts (isSafeHex).
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{3,8}$/, "must be a hex color like #1A1A1A");

// Type-scale ratio: a small curated set (classic modular-scale steps).
const SCALE_RATIOS = [1.125, 1.2, 1.25, 1.333, 1.414, 1.5] as const;

const fontName = z.enum(CURATED_FONTS);

export const themeTokensSchema = z.object({
  colors: z.object({
    background: hexColor,
    surface: hexColor,
    text: hexColor,
    textMuted: hexColor,
    primary: hexColor,
    accent: hexColor,
  }),
  typography: z.object({
    headingFont: fontName,
    bodyFont: fontName,
    // Base body size — clamped to the spec's 15–18px range.
    baseSizePx: z.coerce.number().int().min(15).max(18).catch(16),
    // Modular type-scale ratio — clamped to the nearest sensible default if
    // an out-of-set value sneaks in.
    scaleRatio: z
      .number()
      .refine((v) => (SCALE_RATIOS as readonly number[]).includes(v), {
        message: "must be a curated scale ratio",
      })
      .catch(1.2),
  }),
  // Corner radius in px — clamped 0–24 (the editorial theme tops out small).
  radius: z.coerce.number().int().min(0).max(24).catch(4),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;

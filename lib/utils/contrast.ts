/**
 * WCAG 2.1 contrast ratio utilities.
 *
 * All formulas follow the W3C definition:
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

/**
 * Parse a hex color (#RRGGBB or #RGB) into [r, g, b] in 0-255.
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    return [
      parseInt(cleaned[0] + cleaned[0], 16),
      parseInt(cleaned[1] + cleaned[1], 16),
      parseInt(cleaned[2] + cleaned[2], 16),
    ];
  }
  return [
    parseInt(cleaned.slice(0, 2), 16),
    parseInt(cleaned.slice(2, 4), 16),
    parseInt(cleaned.slice(4, 6), 16),
  ];
}

/**
 * Convert an sRGB channel (0-255) to its linear value.
 */
function srgbToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Calculate relative luminance of a hex color (0 = black, 1 = white).
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

/**
 * Calculate the WCAG contrast ratio between two hex colors.
 * Returns a value between 1 (identical) and 21 (black on white).
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check whether a color meets WCAG AA contrast requirements against white.
 *
 * - Normal text (< 18pt or < 14pt bold): 4.5:1
 * - Large text (>= 18pt or >= 14pt bold): 3:1
 */
export function checkContrastOnWhite(hex: string): {
  ratio: number;
  passesNormalText: boolean;
  passesLargeText: boolean;
} {
  const ratio = contrastRatio(hex, "#ffffff");
  return {
    ratio: Math.round(ratio * 100) / 100,
    passesNormalText: ratio >= 4.5,
    passesLargeText: ratio >= 3,
  };
}

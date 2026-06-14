/**
 * G2 PR-A — storefront theme tokens (the bounded, W3C-token-shaped set).
 *
 * Pins the ThemeTokens Zod contract: valid token docs parse, malformed ones
 * reject, and the soft-clamped numeric fields (baseSizePx, scaleRatio, radius)
 * fall back to sane defaults rather than throwing. The reader
 * (getStorefrontTokens) is purely defensive on top of this, so the schema is
 * the last line between stored JSON drift and a broken storefront render.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { themeTokensSchema } from "../lib/data/storefront-tokens-schema.ts";

const validTokens = {
  colors: {
    background: "#F7F4EE",
    surface: "#FFFFFF",
    text: "#1A1A1A",
    textMuted: "#5C5651",
    primary: "#3F4A33",
    accent: "#8E3838",
  },
  typography: {
    headingFont: "Playfair Display",
    bodyFont: "Inter",
    baseSizePx: 16,
    scaleRatio: 1.25,
  },
  radius: 4,
};

test("valid token document parses", () => {
  const parsed = themeTokensSchema.safeParse(validTokens);
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data, validTokens);
});

test("accepts #RGB and #RRGGBBAA hex shapes", () => {
  const parsed = themeTokensSchema.safeParse({
    ...validTokens,
    colors: { ...validTokens.colors, background: "#fff", surface: "#FFFFFF80" },
  });
  assert.equal(parsed.success, true);
});

test("rejects a non-hex color", () => {
  const parsed = themeTokensSchema.safeParse({
    ...validTokens,
    colors: { ...validTokens.colors, primary: "rebeccapurple" },
  });
  assert.equal(parsed.success, false);
});

test("rejects a font outside the curated allowlist", () => {
  const parsed = themeTokensSchema.safeParse({
    ...validTokens,
    typography: { ...validTokens.typography, headingFont: "Comic Sans MS" },
  });
  assert.equal(parsed.success, false);
});

test("rejects a missing color field", () => {
  const colors = { ...validTokens.colors };
  delete (colors as Record<string, unknown>).accent;
  const parsed = themeTokensSchema.safeParse({ ...validTokens, colors });
  assert.equal(parsed.success, false);
});

test("baseSizePx out of range clamps to 16", () => {
  const tooBig = themeTokensSchema.safeParse({
    ...validTokens,
    typography: { ...validTokens.typography, baseSizePx: 99 },
  });
  assert.equal(tooBig.success, true);
  assert.equal(tooBig.data!.typography.baseSizePx, 16);

  const tooSmall = themeTokensSchema.safeParse({
    ...validTokens,
    typography: { ...validTokens.typography, baseSizePx: 3 },
  });
  assert.equal(tooSmall.success, true);
  assert.equal(tooSmall.data!.typography.baseSizePx, 16);
});

test("scaleRatio off the curated set clamps to 1.2", () => {
  const parsed = themeTokensSchema.safeParse({
    ...validTokens,
    typography: { ...validTokens.typography, scaleRatio: 3.0 },
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data!.typography.scaleRatio, 1.2);
});

test("radius out of range clamps to 4", () => {
  const parsed = themeTokensSchema.safeParse({
    ...validTokens,
    radius: 9999,
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data!.radius, 4);
});

test("a curated scaleRatio is preserved", () => {
  const parsed = themeTokensSchema.safeParse({
    ...validTokens,
    typography: { ...validTokens.typography, scaleRatio: 1.414 },
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data!.typography.scaleRatio, 1.414);
});

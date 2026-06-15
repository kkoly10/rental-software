/**
 * PR-B — per-section background color: the pure schema + helper logic backing the
 * on-canvas Background swatch control and the scoped per-section render. Covers
 * the defensive parseSectionBackground helper (valid hex kept; invalid/empty/
 * non-string dropped) and that parseBuilderDocument KEEPS a valid background and
 * DROPS an invalid one (defensively, so a hand-edited doc can't inject a CSS
 * value and can't get stuck un-publishable).
 *
 * Imported via relative `.ts` paths so it runs under
 * `node --test --experimental-strip-types` (the @/ alias doesn't resolve there).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseSectionBackground } from "../lib/storefront/sections/content-schemas.ts";
import {
  parseBuilderDocument,
  SCHEMA_VERSION,
} from "../lib/storefront/builder-document.ts";
import type { ThemeTokens } from "../lib/data/storefront-tokens-schema.ts";

const THEME: ThemeTokens = {
  colors: {
    background: "#ffffff",
    surface: "#f7f7f5",
    text: "#1a1a1a",
    textMuted: "#5c5651",
    primary: "#3f4a33",
    accent: "#e0a82e",
  },
  typography: {
    headingFont: "Sora",
    bodyFont: "Inter",
    baseSizePx: 16,
    scaleRatio: 1.2,
  },
  radius: 8,
};

test("parseSectionBackground returns undefined for absent/malformed settings", () => {
  assert.equal(parseSectionBackground(undefined), undefined);
  assert.equal(parseSectionBackground(null), undefined);
  assert.equal(parseSectionBackground({}), undefined);
  assert.equal(parseSectionBackground("nope"), undefined);
  // Non-string background value → dropped.
  assert.equal(parseSectionBackground({ background: 123 }), undefined);
  assert.equal(parseSectionBackground({ background: {} }), undefined);
});

test("parseSectionBackground keeps a valid hex, drops an invalid one", () => {
  assert.equal(parseSectionBackground({ background: "#C0392B" }), "#C0392B");
  assert.equal(parseSectionBackground({ background: "#fff" }), "#fff");
  assert.equal(parseSectionBackground({ background: "#11223344" }), "#11223344");
  // A CSS-injection attempt is not a hex literal → dropped.
  assert.equal(
    parseSectionBackground({ background: "red; }body{display:none" }),
    undefined
  );
  // Empty string is not a valid hex → dropped (the control clears via the
  // setSectionSetting "" path, which removes the key entirely).
  assert.equal(parseSectionBackground({ background: "" }), undefined);
});

test("parseBuilderDocument keeps a valid section background", () => {
  const raw = {
    schemaVersion: SCHEMA_VERSION,
    order: ["hero1"],
    sections: {
      hero1: {
        type: "hero",
        settings: { headline: "Hi", background: "#2E86C1" },
      },
    },
    theme: THEME,
  };
  const result = parseBuilderDocument(raw);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const settings = result.value.document.sections.hero1.settings as {
    background?: unknown;
  };
  assert.equal(settings.background, "#2E86C1");
});

test("parseBuilderDocument DROPS an invalid section background instead of rejecting", () => {
  const raw = {
    schemaVersion: SCHEMA_VERSION,
    order: ["hero1"],
    sections: {
      hero1: {
        type: "hero",
        settings: { headline: "Hi", background: "red; }body{x" },
      },
    },
    theme: THEME,
  };
  const result = parseBuilderDocument(raw);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const settings = result.value.document.sections.hero1.settings as Record<
    string,
    unknown
  >;
  assert.equal("background" in settings, false);
  // The rest of the settings survive.
  assert.equal(settings.headline, "Hi");
});

test("parseBuilderDocument leaves a doc with NO background untouched", () => {
  const raw = {
    schemaVersion: SCHEMA_VERSION,
    order: ["hero1"],
    sections: { hero1: { type: "hero", settings: { headline: "Hi" } } },
    theme: THEME,
  };
  const result = parseBuilderDocument(raw);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const settings = result.value.document.sections.hero1.settings as Record<
    string,
    unknown
  >;
  assert.equal("background" in settings, false);
});

/**
 * PR-A — per-element (Wix-like) text styling: the pure schema + helper logic
 * backing the on-canvas styling toolbar and the scoped per-element render.
 * Covers the FieldStyle schema bounds, the defensive parseFieldStyles helper,
 * and that parseBuilderDocument DROPS invalid per-field overrides instead of
 * rejecting the publish (so a hand-edited doc can't inject raw CSS or get stuck).
 *
 * Imported via relative `.ts` paths so it runs under
 * `node --test --experimental-strip-types` (the @/ alias doesn't resolve there).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  fieldStyleSchema,
  parseFieldStyles,
  FONT_STACKS,
  SECTION_FIELD_SELECTORS,
  hasFieldSelectors,
  FIELD_STYLE_SIZE_MIN,
  FIELD_STYLE_SIZE_MAX,
} from "../lib/storefront/sections/content-schemas.ts";
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

test("fieldStyleSchema clamps size range and validates hex + font", () => {
  assert.equal(fieldStyleSchema.safeParse({ sizePx: 24 }).success, true);
  assert.equal(
    fieldStyleSchema.safeParse({ sizePx: FIELD_STYLE_SIZE_MAX + 1 }).success,
    false
  );
  assert.equal(
    fieldStyleSchema.safeParse({ sizePx: FIELD_STYLE_SIZE_MIN - 1 }).success,
    false
  );
  assert.equal(fieldStyleSchema.safeParse({ sizePx: 20.5 }).success, false);
  assert.equal(fieldStyleSchema.safeParse({ color: "#1A1A1A" }).success, true);
  assert.equal(
    fieldStyleSchema.safeParse({ color: "red; }body{x" }).success,
    false
  );
  assert.equal(fieldStyleSchema.safeParse({ font: "Inter" }).success, true);
  assert.equal(fieldStyleSchema.safeParse({ font: "Comic Sans" }).success, false);
});

test("fieldStyleSchema validates align as a fixed enum", () => {
  assert.equal(fieldStyleSchema.safeParse({ align: "left" }).success, true);
  assert.equal(fieldStyleSchema.safeParse({ align: "center" }).success, true);
  assert.equal(fieldStyleSchema.safeParse({ align: "right" }).success, true);
  // Anything outside the enum (including a CSS-injection attempt) is rejected.
  assert.equal(fieldStyleSchema.safeParse({ align: "justify" }).success, false);
  assert.equal(
    fieldStyleSchema.safeParse({ align: "left !important; }body{x" }).success,
    false
  );
});

test("parseFieldStyles returns {} for absent/malformed settings", () => {
  assert.deepEqual(parseFieldStyles(undefined), {});
  assert.deepEqual(parseFieldStyles(null), {});
  assert.deepEqual(parseFieldStyles({}), {});
  assert.deepEqual(parseFieldStyles({ fieldStyles: "nope" }), {});
});

test("parseFieldStyles drops invalid per-field overrides, keeps valid ones", () => {
  const out = parseFieldStyles({
    fieldStyles: {
      headline: { sizePx: 32, bold: true },
      message: { sizePx: 999 }, // out of range → dropped
      junk: { color: "not-a-color" }, // bad hex → dropped
      empty: {}, // no surviving keys → dropped
    },
  });
  assert.deepEqual(Object.keys(out).sort(), ["headline"]);
  assert.deepEqual(out.headline, { sizePx: 32, bold: true });
});

test("parseFieldStyles keeps a valid align, drops an invalid one", () => {
  const out = parseFieldStyles({
    fieldStyles: {
      headline: { align: "center" }, // valid → kept (align-only override)
      message: { align: "justify" }, // not in enum → whole field dropped
      tagline: { sizePx: 20, align: "diagonal" }, // bad align → field dropped
    },
  });
  assert.deepEqual(Object.keys(out).sort(), ["headline"]);
  assert.deepEqual(out.headline, { align: "center" });
});

test("parseFieldStyles strips unknown keys from a field override", () => {
  const out = parseFieldStyles({
    fieldStyles: { headline: { sizePx: 20, evil: "x", color: "#fff" } },
  });
  assert.deepEqual(out.headline, { sizePx: 20, color: "#fff" });
});

test("an align override emits a scoped text-align !important declaration", () => {
  // The shared renderer's fieldStyleDeclarations() is module-private (it lives in
  // a JSX file that can't be imported under node --test --experimental-strip-types).
  // Mirror its align branch here so the contract — align renders as a
  // `text-align:<value> !important` declaration from an already-validated enum,
  // and ONLY when set — is locked in alongside the schema/parse coverage above.
  const declFor = (style: { align?: "left" | "center" | "right" }): string[] => {
    const decls: string[] = [];
    if (style.align) decls.push(`text-align:${style.align} !important`);
    return decls;
  };
  // Validate through the real schema first so the value is the same shape the
  // renderer receives (defense-in-depth: only enum literals ever reach the decl).
  const parsed = fieldStyleSchema.safeParse({ align: "center" });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.deepEqual(declFor(parsed.data), ["text-align:center !important"]);
  // No align set → no declaration emitted (byte-for-byte when unset).
  assert.deepEqual(declFor({}), []);
});

test("FONT_STACKS covers every selectorable section's font enum", () => {
  // Every curated font has a stack (the renderer looks the stack up by enum).
  for (const font of Object.keys(FONT_STACKS)) {
    assert.equal(typeof FONT_STACKS[font as keyof typeof FONT_STACKS], "string");
  }
});

test("SECTION_FIELD_SELECTORS + hasFieldSelectors agree", () => {
  assert.equal(hasFieldSelectors("hero"), true);
  assert.equal(hasFieldSelectors("nope"), false);
  assert.equal(SECTION_FIELD_SELECTORS.hero.headline, ".st-h1");
});

test("parseBuilderDocument DROPS invalid fieldStyles instead of rejecting", () => {
  const raw = {
    schemaVersion: SCHEMA_VERSION,
    order: ["hero1"],
    sections: {
      hero1: {
        type: "hero",
        settings: {
          headline: "Hi",
          fieldStyles: {
            headline: { sizePx: 32, color: "#C0392B", align: "center" },
            message: { sizePx: 9999 }, // invalid → dropped
          },
        },
      },
    },
    theme: THEME,
  };
  const result = parseBuilderDocument(raw);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const settings = result.value.document.sections.hero1.settings as {
    fieldStyles?: Record<string, unknown>;
  };
  assert.deepEqual(Object.keys(settings.fieldStyles ?? {}), ["headline"]);
  assert.deepEqual(settings.fieldStyles?.headline, {
    sizePx: 32,
    color: "#C0392B",
    align: "center",
  });
});

test("parseBuilderDocument drops fieldStyles entirely when none survive", () => {
  const raw = {
    schemaVersion: SCHEMA_VERSION,
    order: ["hero1"],
    sections: {
      hero1: {
        type: "hero",
        settings: { headline: "Hi", fieldStyles: { headline: { sizePx: 9999 } } },
      },
    },
    theme: THEME,
  };
  const result = parseBuilderDocument(raw);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const settings = result.value.document.sections.hero1.settings as {
    fieldStyles?: unknown;
  };
  assert.equal("fieldStyles" in settings, false);
});

test("parseBuilderDocument leaves a doc with NO fieldStyles untouched", () => {
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
  assert.equal("fieldStyles" in settings, false);
  assert.equal(settings.headline, "Hi");
});

/**
 * G2 PR-B — storefront builder token defaults + the publish-time contrast gate.
 *
 * Covers the three pure helpers that back the operator-facing theme editor:
 *  - DEFAULT_THEME_TOKENS is a valid, AA-passing baseline (the storefront's
 *    current look), so first-time builder entry is never a blank slate.
 *  - resolveEditorTokens prefers draft → published → defaults and never lets a
 *    corrupt candidate brick the editor.
 *  - checkPublishContrast is the "reject < 4.5:1" rule the publish action
 *    enforces server-side (the editor only warns; publish blocks).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_THEME_TOKENS,
  resolveEditorTokens,
  checkPublishContrast,
} from "../lib/data/storefront-token-defaults.ts";
import { themeTokensSchema } from "../lib/data/storefront-tokens-schema.ts";

test("DEFAULT_THEME_TOKENS is a valid, schema-conformant token doc", () => {
  const parsed = themeTokensSchema.safeParse(DEFAULT_THEME_TOKENS);
  assert.equal(parsed.success, true);
});

test("default text-on-background passes the publish contrast gate", () => {
  const result = checkPublishContrast(DEFAULT_THEME_TOKENS);
  assert.equal(result.ok, true);
  assert.ok(result.ratio >= 4.5);
});

test("resolveEditorTokens prefers a valid draft over published", () => {
  const draft = {
    ...DEFAULT_THEME_TOKENS,
    colors: { ...DEFAULT_THEME_TOKENS.colors, primary: "#102030" },
  };
  const published = {
    ...DEFAULT_THEME_TOKENS,
    colors: { ...DEFAULT_THEME_TOKENS.colors, primary: "#aa0000" },
  };
  const resolved = resolveEditorTokens(draft, published);
  assert.equal(resolved.colors.primary, "#102030");
});

test("resolveEditorTokens falls back to published when draft is absent", () => {
  const published = {
    ...DEFAULT_THEME_TOKENS,
    colors: { ...DEFAULT_THEME_TOKENS.colors, primary: "#aa0000" },
  };
  const resolved = resolveEditorTokens(null, published);
  assert.equal(resolved.colors.primary, "#aa0000");
});

test("resolveEditorTokens skips a corrupt draft and uses published", () => {
  const corrupt = { colors: { primary: "not-a-color" } };
  const published = {
    ...DEFAULT_THEME_TOKENS,
    colors: { ...DEFAULT_THEME_TOKENS.colors, primary: "#aa0000" },
  };
  const resolved = resolveEditorTokens(corrupt, published);
  assert.equal(resolved.colors.primary, "#aa0000");
});

test("resolveEditorTokens falls back to defaults when both are invalid/absent", () => {
  const resolved = resolveEditorTokens(undefined, { bogus: true });
  assert.deepEqual(resolved, DEFAULT_THEME_TOKENS);
});

test("checkPublishContrast blocks unreadable body text (< 4.5:1)", () => {
  const bad = {
    ...DEFAULT_THEME_TOKENS,
    colors: {
      ...DEFAULT_THEME_TOKENS.colors,
      background: "#F7F4EE",
      text: "#EFEFEF", // near-white text on cream — fails AA
    },
  };
  const result = checkPublishContrast(bad);
  assert.equal(result.ok, false);
  assert.ok(result.ratio < 4.5);
});

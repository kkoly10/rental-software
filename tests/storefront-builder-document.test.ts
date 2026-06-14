/**
 * PR-1b — visible section builder: the PURE builder-document helpers that back
 * the builder UI and the unified save/publish action (spec §2, §4, §10).
 *
 * Covers: seeding a document from synthesized sections, reorder (with pinned
 * end-sections), show/hide (alwaysPresent can't be hidden), theme replacement,
 * and the save/publish validator parseBuilderDocument (whole document + embedded
 * theme validated together; unknown types and dangling order entries rejected).
 *
 * Imported via relative `.ts` paths so it runs under
 * `node --test --experimental-strip-types` (the @/ alias doesn't resolve there).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDocumentFromSynthesized,
  normalizeExistingDocument,
  isAlwaysPresentSection,
  moveSection,
  toggleSectionDisabled,
  setDocumentTheme,
  parseBuilderDocument,
} from "../lib/storefront/builder-document.ts";
import { synthesizeDefaultOrder } from "../lib/storefront/page-document-schema.ts";
import { DEFAULT_THEME_TOKENS } from "../lib/data/storefront-token-defaults.ts";
import type { StorefrontPageDocument } from "../lib/storefront/page-document-schema.ts";

const ALL_VISIBLE = {
  trust_bar: true,
  category_grid: true,
  how_it_works: true,
  faq_section: true,
  about_section: true,
  testimonials: true,
  service_area_map: true,
};

function seedDoc(): StorefrontPageDocument {
  const sections = synthesizeDefaultOrder({
    sectionVisibility: ALL_VISIBLE,
    hasFeatured: true,
    hasServiceAreas: true,
  });
  return buildDocumentFromSynthesized(sections, DEFAULT_THEME_TOKENS);
}

// ---------------------------------------------------------------------------
// build / normalize
// ---------------------------------------------------------------------------

test("buildDocumentFromSynthesized maps order + sections + theme", () => {
  const doc = seedDoc();
  assert.equal(doc.schemaVersion, 1);
  assert.ok(doc.order.length > 0);
  assert.equal(doc.order[0], "sec_hero");
  assert.equal(doc.order[doc.order.length - 1], "sec_closing");
  for (const id of doc.order) {
    assert.ok(doc.sections[id], `section ${id} present`);
  }
  assert.deepEqual(doc.theme, DEFAULT_THEME_TOKENS);
});

test("normalizeExistingDocument re-attaches the resolved theme", () => {
  const existing: StorefrontPageDocument = {
    schemaVersion: 1,
    order: ["sec_hero", "sec_closing"],
    sections: { sec_hero: { type: "hero" }, sec_closing: { type: "closing" } },
    theme: { stale: true },
  };
  const normalized = normalizeExistingDocument(existing, DEFAULT_THEME_TOKENS);
  assert.deepEqual(normalized.theme, DEFAULT_THEME_TOKENS);
  assert.deepEqual(normalized.order, existing.order);
});

// ---------------------------------------------------------------------------
// reorder + pinned ends
// ---------------------------------------------------------------------------

test("isAlwaysPresentSection flags hero/closing only", () => {
  const doc = seedDoc();
  assert.equal(isAlwaysPresentSection(doc, "sec_hero"), true);
  assert.equal(isAlwaysPresentSection(doc, "sec_closing"), true);
  assert.equal(isAlwaysPresentSection(doc, "sec_trust"), false);
});

test("moveSection reorders a movable section and returns a new array", () => {
  const doc = seedDoc();
  const i = doc.order.indexOf("sec_trust");
  const next = moveSection(doc, "sec_trust", 1);
  assert.notEqual(next, doc.order);
  assert.equal(next.indexOf("sec_trust"), i + 1);
});

test("moveSection won't move a pinned section (no-op, same ref)", () => {
  const doc = seedDoc();
  assert.equal(moveSection(doc, "sec_hero", 1), doc.order);
  assert.equal(moveSection(doc, "sec_closing", -1), doc.order);
});

test("moveSection won't let a movable section cross a pinned end", () => {
  const doc = seedDoc();
  // First movable section can't move up past pinned hero at index 0.
  const firstMovable = doc.order[1];
  assert.equal(moveSection(doc, firstMovable, -1), doc.order);
  // Last movable section can't move down past pinned closing.
  const lastMovable = doc.order[doc.order.length - 2];
  assert.equal(moveSection(doc, lastMovable, 1), doc.order);
});

// ---------------------------------------------------------------------------
// show / hide
// ---------------------------------------------------------------------------

test("toggleSectionDisabled flips a movable section's disabled flag", () => {
  const doc = seedDoc();
  const toggled = toggleSectionDisabled(doc, "sec_trust");
  assert.equal(toggled.sections.sec_trust.disabled, true);
  const back = toggleSectionDisabled(toggled, "sec_trust");
  assert.equal(back.sections.sec_trust.disabled, false);
});

test("toggleSectionDisabled can't hide an alwaysPresent section", () => {
  const doc = seedDoc();
  assert.equal(toggleSectionDisabled(doc, "sec_hero"), doc);
});

test("setDocumentTheme replaces only the theme", () => {
  const doc = seedDoc();
  const newTheme = { ...DEFAULT_THEME_TOKENS, radius: 12 };
  const next = setDocumentTheme(doc, newTheme);
  assert.deepEqual(next.theme, newTheme);
  assert.deepEqual(next.order, doc.order);
});

// ---------------------------------------------------------------------------
// parseBuilderDocument (the save/publish validator)
// ---------------------------------------------------------------------------

test("parseBuilderDocument accepts a valid document + theme", () => {
  const doc = seedDoc();
  const result = parseBuilderDocument(JSON.parse(JSON.stringify(doc)));
  assert.equal(result.ok, true);
  if (result.ok) {
    // theme normalized back onto the document = one coherent object.
    assert.deepEqual(result.value.document.theme, result.value.theme);
  }
});

test("parseBuilderDocument rejects an empty order", () => {
  const result = parseBuilderDocument({
    schemaVersion: 1,
    order: [],
    sections: {},
    theme: DEFAULT_THEME_TOKENS,
  });
  assert.equal(result.ok, false);
});

test("parseBuilderDocument rejects a dangling order reference", () => {
  const result = parseBuilderDocument({
    schemaVersion: 1,
    order: ["sec_ghost"],
    sections: {},
    theme: DEFAULT_THEME_TOKENS,
  });
  assert.equal(result.ok, false);
});

test("parseBuilderDocument rejects an unknown section type", () => {
  const result = parseBuilderDocument({
    schemaVersion: 1,
    order: ["sec_x"],
    sections: { sec_x: { type: "not-a-real-type" } },
    theme: DEFAULT_THEME_TOKENS,
  });
  assert.equal(result.ok, false);
});

test("parseBuilderDocument rejects a missing/invalid theme", () => {
  const result = parseBuilderDocument({
    schemaVersion: 1,
    order: ["sec_hero"],
    sections: { sec_hero: { type: "hero" } },
    theme: { colors: { background: "not-a-hex" } },
  });
  assert.equal(result.ok, false);
});

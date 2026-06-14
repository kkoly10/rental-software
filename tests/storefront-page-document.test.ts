/**
 * PR-1a — storefront section builder: page-document SHAPE + the default-order
 * synthesizer. Covers the two pure pieces that back the DORMANT document-driven
 * render path (see docs/saas/storefront-builder-spec.md §2, §7):
 *
 *  - storefrontPageDocumentSchema: the Zod validator the defensive reader uses.
 *    Valid docs parse; docs missing/with-a-bad `order` fail (the reader maps a
 *    parse failure — and separately an EMPTY order — to null → legacy render).
 *  - synthesizeDefaultOrder: produces today's EXACT section sequence + visibility
 *    so a seeded document publishes byte-for-byte what the org renders today.
 *
 * Imported from page-document-schema.ts (zero server deps) via relative `.ts`
 * paths so it runs under `node --test --experimental-strip-types` — the @/ alias
 * does not resolve there (project convention, see storefront-token-defaults.test.ts).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  storefrontPageDocumentSchema,
  synthesizeDefaultOrder,
} from "../lib/storefront/page-document-schema.ts";
import { DEFAULT_SECTION_ORDER } from "../lib/storefront/sections/registry.ts";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

test("schema accepts a well-formed page document", () => {
  const doc = {
    schemaVersion: 1,
    order: ["sec_hero", "sec_closing"],
    sections: {
      sec_hero: { type: "hero" },
      sec_closing: { type: "closing", disabled: false, settings: {} },
    },
    theme: { colors: { primary: "#000" } },
  };
  const parsed = storefrontPageDocumentSchema.safeParse(doc);
  assert.equal(parsed.success, true);
});

test("schema accepts a document with no theme (theme is optional)", () => {
  const parsed = storefrontPageDocumentSchema.safeParse({
    schemaVersion: 1,
    order: ["sec_hero"],
    sections: { sec_hero: { type: "hero" } },
  });
  assert.equal(parsed.success, true);
});

test("schema accepts an EMPTY order array (reader treats it as null separately)", () => {
  // The schema itself permits [] — the 'not built yet' → null mapping for an
  // empty order is the READER's job, not the schema's. This documents that split.
  const parsed = storefrontPageDocumentSchema.safeParse({
    schemaVersion: 1,
    order: [],
    sections: {},
  });
  assert.equal(parsed.success, true);
});

test("schema REJECTS a document missing the order array", () => {
  const parsed = storefrontPageDocumentSchema.safeParse({
    schemaVersion: 1,
    sections: { sec_hero: { type: "hero" } },
  });
  assert.equal(parsed.success, false);
});

test("schema REJECTS order that is not an array of strings", () => {
  const parsed = storefrontPageDocumentSchema.safeParse({
    schemaVersion: 1,
    order: [1, 2, 3],
    sections: {},
  });
  assert.equal(parsed.success, false);
});

test("schema REJECTS a section record missing its type", () => {
  const parsed = storefrontPageDocumentSchema.safeParse({
    schemaVersion: 1,
    order: ["sec_x"],
    sections: { sec_x: { disabled: true } },
  });
  assert.equal(parsed.success, false);
});

test("schema REJECTS a non-numeric schemaVersion", () => {
  const parsed = storefrontPageDocumentSchema.safeParse({
    schemaVersion: "1",
    order: ["sec_hero"],
    sections: { sec_hero: { type: "hero" } },
  });
  assert.equal(parsed.success, false);
});

test("schema REJECTS non-object junk", () => {
  assert.equal(storefrontPageDocumentSchema.safeParse(null).success, false);
  assert.equal(storefrontPageDocumentSchema.safeParse("nope").success, false);
  assert.equal(storefrontPageDocumentSchema.safeParse([]).success, false);
});

// ---------------------------------------------------------------------------
// synthesizeDefaultOrder
// ---------------------------------------------------------------------------

// Everything visible (the "all defaults on" tenant) plus the data-gated
// sections present.
const allOn = {
  sectionVisibility: {
    trust_bar: true,
    category_grid: true,
    how_it_works: true,
    testimonials: true,
    service_area_map: true,
    about_section: true,
    faq_section: true,
  },
  hasFeatured: true,
  hasServiceAreas: true,
};

test("default order matches today's exact section sequence (all present)", () => {
  const types = synthesizeDefaultOrder(allOn).map((s) => s.type);
  assert.deepEqual(types, DEFAULT_SECTION_ORDER);
});

test("with empty visibility + no data: data-gated sections drop, !==false sections stay enabled", () => {
  // Empty visibility map = every `!== false` flag is satisfied (undefined !== false),
  // so those sections are present+enabled; truthy-gated testimonials is disabled;
  // featured + service-area drop entirely (no data).
  const sections = synthesizeDefaultOrder({
    sectionVisibility: {},
    hasFeatured: false,
    hasServiceAreas: false,
  });
  const types = sections.map((s) => s.type);
  assert.deepEqual(types, [
    "hero",
    "trust",
    "press",
    "category-grid",
    "browse-tiles",
    // featured dropped (no data)
    "how-it-works",
    "testimonials",
    // service-area dropped (no data)
    "about",
    "faq",
    "closing",
  ]);

  const byType = Object.fromEntries(sections.map((s) => [s.type, s.disabled]));
  assert.equal(byType.hero, false);
  assert.equal(byType.trust, false);
  assert.equal(byType["how-it-works"], false);
  assert.equal(byType.about, false); // undefined !== false → enabled
  assert.equal(byType.faq, false);
  assert.equal(byType.closing, false);
  // testimonials is truthy-gated and default off.
  assert.equal(byType.testimonials, true);
});

test("explicit visibility=false marks the matching section disabled (not removed)", () => {
  const sections = synthesizeDefaultOrder({
    sectionVisibility: {
      trust_bar: false,
      how_it_works: false,
      faq_section: false,
      about_section: false,
    },
    hasFeatured: true,
    hasServiceAreas: true,
  });
  const byType = Object.fromEntries(sections.map((s) => [s.type, s.disabled]));
  assert.equal(byType.trust, true);
  assert.equal(byType["how-it-works"], true);
  assert.equal(byType.faq, true);
  assert.equal(byType.about, true);
  // category_grid drives BOTH category-grid and browse-tiles.
  assert.equal(byType["category-grid"], false);
  assert.equal(byType["browse-tiles"], false);
});

test("category_grid=false disables both category-grid AND browse-tiles", () => {
  const sections = synthesizeDefaultOrder({
    sectionVisibility: { category_grid: false },
    hasFeatured: false,
    hasServiceAreas: false,
  });
  const byType = Object.fromEntries(sections.map((s) => [s.type, s.disabled]));
  assert.equal(byType["category-grid"], true);
  assert.equal(byType["browse-tiles"], true);
});

test("featured is included ONLY when hasFeatured", () => {
  const without = synthesizeDefaultOrder({ ...allOn, hasFeatured: false });
  assert.equal(
    without.some((s) => s.type === "featured"),
    false
  );
  const withIt = synthesizeDefaultOrder({ ...allOn, hasFeatured: true });
  assert.equal(
    withIt.some((s) => s.type === "featured"),
    true
  );
});

test("service-area is included ONLY when hasServiceAreas AND not visibility=false", () => {
  // No data → absent.
  assert.equal(
    synthesizeDefaultOrder({ ...allOn, hasServiceAreas: false }).some(
      (s) => s.type === "service-area"
    ),
    false
  );
  // Has data but turned off → absent (matches today: the gated div isn't rendered).
  assert.equal(
    synthesizeDefaultOrder({
      ...allOn,
      hasServiceAreas: true,
      sectionVisibility: { ...allOn.sectionVisibility, service_area_map: false },
    }).some((s) => s.type === "service-area"),
    false
  );
  // Has data and on → present.
  assert.equal(
    synthesizeDefaultOrder({ ...allOn, hasServiceAreas: true }).some(
      (s) => s.type === "service-area"
    ),
    true
  );
});

test("hero and closing are always present and enabled", () => {
  const sections = synthesizeDefaultOrder({
    sectionVisibility: {},
    hasFeatured: false,
    hasServiceAreas: false,
  });
  const hero = sections.find((s) => s.type === "hero");
  const closing = sections.find((s) => s.type === "closing");
  assert.ok(hero && hero.disabled === false);
  assert.ok(closing && closing.disabled === false);
});

test("synthesized IDs are stable deterministic sec_<type> keys", () => {
  const sections = synthesizeDefaultOrder(allOn);
  for (const s of sections) {
    assert.equal(s.id, `sec_${s.type}`);
  }
});

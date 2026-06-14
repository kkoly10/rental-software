/**
 * PR-1c — per-section CONTENT editing (hero + about): the pure schema +
 * helper logic backing the content editor and the publish-path validation
 * (spec §2). Covers the bounded settings schemas, the defensive parse helpers,
 * the setSectionSetting document patcher, and that parseBuilderDocument
 * round-trips / normalizes / rejects per-section content settings.
 *
 * Imported via relative `.ts` paths so it runs under
 * `node --test --experimental-strip-types` (the @/ alias doesn't resolve there).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  heroSettingsSchema,
  aboutSettingsSchema,
  parseHeroSettings,
  parseAboutSettings,
  isContentEditableSectionType,
  HERO_HEADLINE_MAX,
  HERO_MESSAGE_MAX,
  ABOUT_BODY_MAX,
} from "../lib/storefront/sections/content-schemas.ts";
import {
  buildDocumentFromSynthesized,
  setSectionSetting,
  parseBuilderDocument,
} from "../lib/storefront/builder-document.ts";
import { synthesizeDefaultOrder } from "../lib/storefront/page-document-schema.ts";
import { DEFAULT_THEME_TOKENS } from "../lib/data/storefront-token-defaults.ts";

const ALL_VISIBLE = {
  trust_bar: true,
  category_grid: true,
  how_it_works: true,
  faq_section: true,
  about_section: true,
  testimonials: true,
  service_area_map: true,
};

function seedDoc() {
  const sections = synthesizeDefaultOrder({
    sectionVisibility: ALL_VISIBLE,
    hasFeatured: true,
    hasServiceAreas: true,
  });
  return buildDocumentFromSynthesized(sections, DEFAULT_THEME_TOKENS);
}

// ---------------------------------------------------------------------------
// schemas
// ---------------------------------------------------------------------------

test("heroSettingsSchema accepts all-optional / empty settings", () => {
  assert.equal(heroSettingsSchema.safeParse({}).success, true);
  const r = heroSettingsSchema.safeParse({
    headline: "Tents & tables",
    message: "Delivered and set up.",
    imageUrl: "https://cdn.example.com/hero.jpg",
  });
  assert.equal(r.success, true);
});

test("heroSettingsSchema enforces length caps", () => {
  assert.equal(
    heroSettingsSchema.safeParse({ headline: "x".repeat(HERO_HEADLINE_MAX + 1) }).success,
    false
  );
  assert.equal(
    heroSettingsSchema.safeParse({ message: "x".repeat(HERO_MESSAGE_MAX + 1) }).success,
    false
  );
});

test("heroSettingsSchema rejects non-http image URLs", () => {
  assert.equal(
    heroSettingsSchema.safeParse({ imageUrl: "javascript:alert(1)" }).success,
    false
  );
  assert.equal(
    heroSettingsSchema.safeParse({ imageUrl: "not-a-url" }).success,
    false
  );
});

test("aboutSettingsSchema bounds the body length", () => {
  assert.equal(aboutSettingsSchema.safeParse({ body: "hi" }).success, true);
  assert.equal(
    aboutSettingsSchema.safeParse({ body: "x".repeat(ABOUT_BODY_MAX + 1) }).success,
    false
  );
});

test("isContentEditableSectionType is true only for hero + about", () => {
  assert.equal(isContentEditableSectionType("hero"), true);
  assert.equal(isContentEditableSectionType("about"), true);
  assert.equal(isContentEditableSectionType("trust"), false);
  assert.equal(isContentEditableSectionType("faq"), false);
});

// ---------------------------------------------------------------------------
// defensive parse helpers (fallback safety)
// ---------------------------------------------------------------------------

test("parseHeroSettings returns {} for absent/malformed settings (all fallbacks)", () => {
  assert.deepEqual(parseHeroSettings(undefined), {});
  assert.deepEqual(parseHeroSettings(null), {});
  // Malformed (over-cap headline) must not crash the render path — fall back.
  assert.deepEqual(parseHeroSettings({ headline: "x".repeat(999) }), {});
});

test("parseHeroSettings passes through valid fields", () => {
  assert.deepEqual(parseHeroSettings({ headline: "Hi", message: "There" }), {
    headline: "Hi",
    message: "There",
  });
});

test("parseAboutSettings returns {} for absent/malformed settings", () => {
  assert.deepEqual(parseAboutSettings(undefined), {});
  assert.deepEqual(parseAboutSettings({ body: "x".repeat(ABOUT_BODY_MAX + 1) }), {});
});

// ---------------------------------------------------------------------------
// setSectionSetting (document patcher)
// ---------------------------------------------------------------------------

test("setSectionSetting writes a field immutably", () => {
  const doc = seedDoc();
  const next = setSectionSetting(doc, "sec_hero", "headline", "New headline");
  assert.notEqual(next, doc);
  assert.equal(next.sections.sec_hero.settings?.headline, "New headline");
  // Original untouched.
  assert.equal(doc.sections.sec_hero.settings?.headline, undefined);
});

test("setSectionSetting deletes the key on empty value (fallback to default)", () => {
  const doc = setSectionSetting(seedDoc(), "sec_hero", "headline", "X");
  const cleared = setSectionSetting(doc, "sec_hero", "headline", "");
  assert.equal("headline" in (cleared.sections.sec_hero.settings ?? {}), false);
});

test("setSectionSetting is a no-op (same ref) for an unknown id", () => {
  const doc = seedDoc();
  assert.equal(setSectionSetting(doc, "sec_ghost", "headline", "X"), doc);
});

// ---------------------------------------------------------------------------
// parseBuilderDocument round-trips + normalizes per-section settings
// ---------------------------------------------------------------------------

test("parseBuilderDocument accepts + preserves valid hero/about settings", () => {
  let doc = seedDoc();
  doc = setSectionSetting(doc, "sec_hero", "headline", "Tents & tables");
  doc = setSectionSetting(doc, "sec_about", "body", "We've served the area for 10 years.");
  const result = parseBuilderDocument(JSON.parse(JSON.stringify(doc)));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.document.sections.sec_hero.settings?.headline, "Tents & tables");
    assert.equal(
      result.value.document.sections.sec_about.settings?.body,
      "We've served the area for 10 years."
    );
  }
});

test("parseBuilderDocument rejects an over-cap hero headline on publish", () => {
  let doc = seedDoc();
  doc = setSectionSetting(doc, "sec_hero", "headline", "x".repeat(HERO_HEADLINE_MAX + 1));
  const result = parseBuilderDocument(JSON.parse(JSON.stringify(doc)));
  assert.equal(result.ok, false);
});

test("parseBuilderDocument strips unknown keys from content settings", () => {
  const doc = seedDoc();
  const raw = JSON.parse(JSON.stringify(doc));
  raw.sections.sec_hero.settings = { headline: "Hi", bogus: "drop me" };
  const result = parseBuilderDocument(raw);
  assert.equal(result.ok, true);
  if (result.ok) {
    const s = result.value.document.sections.sec_hero.settings ?? {};
    assert.equal(s.headline, "Hi");
    assert.equal("bogus" in s, false);
  }
});

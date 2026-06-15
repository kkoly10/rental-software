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
  trustSettingsSchema,
  testimonialsSettingsSchema,
  faqSettingsSchema,
  parseHeroSettings,
  parseAboutSettings,
  parseTrustSettings,
  parseTestimonialsSettings,
  parseFaqSettings,
  isContentEditableSectionType,
  HERO_HEADLINE_MAX,
  HERO_MESSAGE_MAX,
  ABOUT_BODY_MAX,
  TRUST_TITLE_MAX,
  TRUST_BADGES_MAX,
  TESTIMONIAL_TEXT_MAX,
  TESTIMONIALS_MAX,
  FAQ_QUESTION_MAX,
  FAQ_ITEMS_MAX,
} from "../lib/storefront/sections/content-schemas.ts";
import {
  buildDocumentFromSynthesized,
  setSectionSetting,
  setSectionSettingValue,
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

test("isContentEditableSectionType covers the PR-1c/1d editable types", () => {
  assert.equal(isContentEditableSectionType("hero"), true);
  assert.equal(isContentEditableSectionType("about"), true);
  assert.equal(isContentEditableSectionType("trust"), true);
  assert.equal(isContentEditableSectionType("testimonials"), true);
  assert.equal(isContentEditableSectionType("faq"), true);
  // Types with no content form remain non-editable.
  assert.equal(isContentEditableSectionType("press"), false);
  assert.equal(isContentEditableSectionType("closing"), false);
});

// ---------------------------------------------------------------------------
// PR-1d schemas: trust / testimonials / faq
// ---------------------------------------------------------------------------

test("trustSettingsSchema accepts empty / valid; caps title length + count", () => {
  assert.equal(trustSettingsSchema.safeParse({}).success, true);
  assert.equal(
    trustSettingsSchema.safeParse({
      badges: [{ title: "Free delivery", description: "On every order." }],
    }).success,
    true
  );
  // Over the per-badge title cap.
  assert.equal(
    trustSettingsSchema.safeParse({
      badges: [{ title: "x".repeat(TRUST_TITLE_MAX + 1), description: "ok" }],
    }).success,
    false
  );
  // Over the badge count cap.
  assert.equal(
    trustSettingsSchema.safeParse({
      badges: Array.from({ length: TRUST_BADGES_MAX + 1 }, () => ({
        title: "t",
        description: "d",
      })),
    }).success,
    false
  );
});

test("testimonialsSettingsSchema bounds text, count, and rating range", () => {
  assert.equal(testimonialsSettingsSchema.safeParse({}).success, true);
  assert.equal(
    testimonialsSettingsSchema.safeParse({
      items: [{ name: "Ana", text: "Great service.", rating: 5 }],
    }).success,
    true
  );
  // Rating out of 1–5 range.
  assert.equal(
    testimonialsSettingsSchema.safeParse({
      items: [{ name: "Ana", text: "ok", rating: 6 }],
    }).success,
    false
  );
  // Over the text cap.
  assert.equal(
    testimonialsSettingsSchema.safeParse({
      items: [{ name: "Ana", text: "x".repeat(TESTIMONIAL_TEXT_MAX + 1) }],
    }).success,
    false
  );
  // Over the count cap.
  assert.equal(
    testimonialsSettingsSchema.safeParse({
      items: Array.from({ length: TESTIMONIALS_MAX + 1 }, () => ({
        name: "n",
        text: "t",
      })),
    }).success,
    false
  );
});

test("faqSettingsSchema bounds question length and item count", () => {
  assert.equal(faqSettingsSchema.safeParse({}).success, true);
  assert.equal(
    faqSettingsSchema.safeParse({
      items: [{ question: "Do you deliver?", answer: "Yes." }],
    }).success,
    true
  );
  assert.equal(
    faqSettingsSchema.safeParse({
      items: [{ question: "x".repeat(FAQ_QUESTION_MAX + 1), answer: "a" }],
    }).success,
    false
  );
  assert.equal(
    faqSettingsSchema.safeParse({
      items: Array.from({ length: FAQ_ITEMS_MAX + 1 }, () => ({
        question: "q",
        answer: "a",
      })),
    }).success,
    false
  );
});

test("parseTrustSettings returns {} for absent/malformed (fall back to today)", () => {
  assert.deepEqual(parseTrustSettings(undefined), {});
  assert.deepEqual(parseTrustSettings(null), {});
  // Malformed (over-cap title) → {} so the trust strip uses its default badges.
  assert.deepEqual(
    parseTrustSettings({ badges: [{ title: "x".repeat(999), description: "d" }] }),
    {}
  );
  assert.deepEqual(
    parseTrustSettings({ badges: [{ title: "Free delivery", description: "On every order." }] }),
    { badges: [{ title: "Free delivery", description: "On every order." }] }
  );
});

test("parseTestimonialsSettings returns {} for absent/malformed (fall back to today)", () => {
  assert.deepEqual(parseTestimonialsSettings(undefined), {});
  assert.deepEqual(parseTestimonialsSettings({ items: [{ name: "A", text: "t", rating: 9 }] }), {});
  assert.deepEqual(parseTestimonialsSettings({ items: [{ name: "Ana", text: "Great." }] }), {
    items: [{ name: "Ana", text: "Great." }],
  });
});

test("parseFaqSettings returns {} for absent/malformed (fall back to today)", () => {
  assert.deepEqual(parseFaqSettings(undefined), {});
  assert.deepEqual(parseFaqSettings({ items: [{ question: "x".repeat(999), answer: "a" }] }), {});
  assert.deepEqual(parseFaqSettings({ items: [{ question: "Do you deliver?", answer: "Yes." }] }), {
    items: [{ question: "Do you deliver?", answer: "Yes." }],
  });
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

test("setSectionSettingValue writes an array immutably", () => {
  const doc = seedDoc();
  const badges = [{ title: "Free delivery", description: "On every order." }];
  const next = setSectionSettingValue(doc, "sec_trust", "badges", badges);
  assert.notEqual(next, doc);
  assert.deepEqual(next.sections.sec_trust.settings?.badges, badges);
  assert.equal(doc.sections.sec_trust.settings?.badges, undefined);
});

test("setSectionSettingValue deletes the key on an empty array (fallback to default)", () => {
  let doc = setSectionSettingValue(seedDoc(), "sec_trust", "badges", [
    { title: "t", description: "d" },
  ]);
  doc = setSectionSettingValue(doc, "sec_trust", "badges", []);
  assert.equal("badges" in (doc.sections.sec_trust.settings ?? {}), false);
});

test("setSectionSettingValue is a no-op (same ref) for an unknown id", () => {
  const doc = seedDoc();
  assert.equal(setSectionSettingValue(doc, "sec_ghost", "badges", [{ title: "t", description: "d" }]), doc);
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

test("parseBuilderDocument accepts + preserves valid trust/testimonials/faq settings", () => {
  let doc = seedDoc();
  doc = setSectionSettingValue(doc, "sec_trust", "badges", [
    { title: "Free delivery", description: "On every order." },
  ]);
  doc = setSectionSettingValue(doc, "sec_testimonials", "items", [
    { name: "Ana", text: "Great service.", rating: 5 },
  ]);
  doc = setSectionSettingValue(doc, "sec_faq", "items", [
    { question: "Do you deliver?", answer: "Yes, area-wide." },
  ]);
  const result = parseBuilderDocument(JSON.parse(JSON.stringify(doc)));
  assert.equal(result.ok, true);
  if (result.ok) {
    const s = result.value.document.sections;
    assert.deepEqual(s.sec_trust.settings?.badges, [
      { title: "Free delivery", description: "On every order." },
    ]);
    assert.deepEqual(s.sec_testimonials.settings?.items, [
      { name: "Ana", text: "Great service.", rating: 5 },
    ]);
    assert.deepEqual(s.sec_faq.settings?.items, [
      { question: "Do you deliver?", answer: "Yes, area-wide." },
    ]);
  }
});

test("parseBuilderDocument rejects an out-of-range testimonial rating on publish", () => {
  let doc = seedDoc();
  doc = setSectionSettingValue(doc, "sec_testimonials", "items", [
    { name: "Ana", text: "ok", rating: 9 },
  ]);
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

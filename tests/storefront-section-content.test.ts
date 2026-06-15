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
  customRichSettingsSchema,
  customImageSettingsSchema,
  customGallerySettingsSchema,
  closingSettingsSchema,
  howItWorksSettingsSchema,
  serviceAreaSettingsSchema,
  featuredSettingsSchema,
  parseHeroSettings,
  parseAboutSettings,
  parseTrustSettings,
  parseTestimonialsSettings,
  parseFaqSettings,
  parseCustomRichSettings,
  parseCustomImageSettings,
  parseCustomGallerySettings,
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
  CUSTOM_RICH_HEADING_MAX,
  CUSTOM_RICH_BODY_MAX,
  CUSTOM_IMAGE_ALT_MAX,
  CUSTOM_IMAGE_CAPTION_MAX,
  CUSTOM_GALLERY_ALT_MAX,
  CUSTOM_GALLERY_IMAGES_MAX,
  CLOSING_HEADING_MAX,
  CLOSING_BODY_MAX,
  CLOSING_BUTTON_LABEL_MAX,
  HOW_IT_WORKS_HEADING_MAX,
  HOW_IT_WORKS_INTRO_MAX,
  HOW_IT_WORKS_STEPS_MAX,
  HOW_IT_WORKS_STEP_TITLE_MAX,
  SERVICE_AREA_HEADING_MAX,
  SERVICE_AREA_INTRO_MAX,
  FEATURED_KICKER_MAX,
  FEATURED_TITLE_MAX,
  FEATURED_DESCRIPTION_MAX,
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

test("isContentEditableSectionType covers the PR-1c/1d/1e/1f editable types", () => {
  assert.equal(isContentEditableSectionType("hero"), true);
  assert.equal(isContentEditableSectionType("about"), true);
  assert.equal(isContentEditableSectionType("trust"), true);
  assert.equal(isContentEditableSectionType("testimonials"), true);
  assert.equal(isContentEditableSectionType("faq"), true);
  assert.equal(isContentEditableSectionType("custom-rich"), true);
  assert.equal(isContentEditableSectionType("custom-image"), true);
  assert.equal(isContentEditableSectionType("custom-gallery"), true);
  // PR-1f: previously non-editable TEXT sections are now editable.
  assert.equal(isContentEditableSectionType("closing"), true);
  assert.equal(isContentEditableSectionType("how-it-works"), true);
  assert.equal(isContentEditableSectionType("service-area"), true);
  assert.equal(isContentEditableSectionType("featured"), true);
  // Types with no editable text remain non-editable.
  assert.equal(isContentEditableSectionType("press"), false);
  assert.equal(isContentEditableSectionType("category-grid"), false);
});

// ---------------------------------------------------------------------------
// PR-1f schemas: closing / how-it-works / service-area / featured
// ---------------------------------------------------------------------------

test("closingSettingsSchema accepts empty / valid; bounds all fields", () => {
  assert.equal(closingSettingsSchema.safeParse({}).success, true);
  assert.equal(
    closingSettingsSchema.safeParse({
      heading: "Ready?",
      body: "Book today.",
      buttonLabel: "Check availability",
    }).success,
    true
  );
  assert.equal(
    closingSettingsSchema.safeParse({ heading: "x".repeat(CLOSING_HEADING_MAX + 1) }).success,
    false
  );
  assert.equal(
    closingSettingsSchema.safeParse({ body: "x".repeat(CLOSING_BODY_MAX + 1) }).success,
    false
  );
  assert.equal(
    closingSettingsSchema.safeParse({ buttonLabel: "x".repeat(CLOSING_BUTTON_LABEL_MAX + 1) })
      .success,
    false
  );
});

test("howItWorksSettingsSchema accepts empty / valid; bounds heading/intro + steps", () => {
  assert.equal(howItWorksSettingsSchema.safeParse({}).success, true);
  assert.equal(
    howItWorksSettingsSchema.safeParse({
      heading: "How it works",
      intro: "Three simple steps",
      steps: [{ title: "Browse", description: "Pick your gear" }],
    }).success,
    true
  );
  assert.equal(
    howItWorksSettingsSchema.safeParse({ heading: "x".repeat(HOW_IT_WORKS_HEADING_MAX + 1) })
      .success,
    false
  );
  assert.equal(
    howItWorksSettingsSchema.safeParse({ intro: "x".repeat(HOW_IT_WORKS_INTRO_MAX + 1) }).success,
    false
  );
  // Over the step cap is rejected.
  assert.equal(
    howItWorksSettingsSchema.safeParse({
      steps: Array.from({ length: HOW_IT_WORKS_STEPS_MAX + 1 }, () => ({
        title: "t",
        description: "d",
      })),
    }).success,
    false
  );
  // A step with an over-cap title is rejected.
  assert.equal(
    howItWorksSettingsSchema.safeParse({
      steps: [{ title: "x".repeat(HOW_IT_WORKS_STEP_TITLE_MAX + 1), description: "d" }],
    }).success,
    false
  );
});

test("serviceAreaSettingsSchema accepts empty / valid; bounds heading + intro", () => {
  assert.equal(serviceAreaSettingsSchema.safeParse({}).success, true);
  assert.equal(
    serviceAreaSettingsSchema.safeParse({ heading: "Where we serve", intro: "Across the metro" })
      .success,
    true
  );
  assert.equal(
    serviceAreaSettingsSchema.safeParse({ heading: "x".repeat(SERVICE_AREA_HEADING_MAX + 1) })
      .success,
    false
  );
  assert.equal(
    serviceAreaSettingsSchema.safeParse({ intro: "x".repeat(SERVICE_AREA_INTRO_MAX + 1) }).success,
    false
  );
});

test("featuredSettingsSchema accepts empty / valid; bounds kicker/title/description", () => {
  assert.equal(featuredSettingsSchema.safeParse({}).success, true);
  assert.equal(
    featuredSettingsSchema.safeParse({
      kicker: "Popular",
      title: "Top picks",
      description: "Our most-booked items",
    }).success,
    true
  );
  assert.equal(
    featuredSettingsSchema.safeParse({ kicker: "x".repeat(FEATURED_KICKER_MAX + 1) }).success,
    false
  );
  assert.equal(
    featuredSettingsSchema.safeParse({ title: "x".repeat(FEATURED_TITLE_MAX + 1) }).success,
    false
  );
  assert.equal(
    featuredSettingsSchema.safeParse({ description: "x".repeat(FEATURED_DESCRIPTION_MAX + 1) })
      .success,
    false
  );
});

// ---------------------------------------------------------------------------
// PR-1e schemas: custom-rich / custom-image / custom-gallery
// ---------------------------------------------------------------------------

test("customRichSettingsSchema accepts empty / valid; bounds heading + body", () => {
  assert.equal(customRichSettingsSchema.safeParse({}).success, true);
  assert.equal(
    customRichSettingsSchema.safeParse({ heading: "Our story", body: "Line 1\nLine 2" }).success,
    true
  );
  assert.equal(
    customRichSettingsSchema.safeParse({ heading: "x".repeat(CUSTOM_RICH_HEADING_MAX + 1) }).success,
    false
  );
  assert.equal(
    customRichSettingsSchema.safeParse({ body: "x".repeat(CUSTOM_RICH_BODY_MAX + 1) }).success,
    false
  );
});

test("customImageSettingsSchema accepts empty / valid; rejects bad URLs + over-cap text", () => {
  assert.equal(customImageSettingsSchema.safeParse({}).success, true);
  assert.equal(
    customImageSettingsSchema.safeParse({
      imageUrl: "https://cdn.example.com/a.jpg",
      alt: "A tent",
      caption: "Set up at dusk",
    }).success,
    true
  );
  assert.equal(
    customImageSettingsSchema.safeParse({ imageUrl: "javascript:alert(1)" }).success,
    false
  );
  assert.equal(
    customImageSettingsSchema.safeParse({
      imageUrl: "https://cdn.example.com/a.jpg",
      alt: "x".repeat(CUSTOM_IMAGE_ALT_MAX + 1),
    }).success,
    false
  );
  assert.equal(
    customImageSettingsSchema.safeParse({
      imageUrl: "https://cdn.example.com/a.jpg",
      caption: "x".repeat(CUSTOM_IMAGE_CAPTION_MAX + 1),
    }).success,
    false
  );
});

test("customGallerySettingsSchema bounds count, requires imageUrl, bounds alt", () => {
  assert.equal(customGallerySettingsSchema.safeParse({}).success, true);
  assert.equal(
    customGallerySettingsSchema.safeParse({
      images: [{ imageUrl: "https://cdn.example.com/a.jpg", alt: "A" }],
    }).success,
    true
  );
  // Item without a (valid) imageUrl is rejected.
  assert.equal(
    customGallerySettingsSchema.safeParse({ images: [{ alt: "no url" }] }).success,
    false
  );
  assert.equal(
    customGallerySettingsSchema.safeParse({ images: [{ imageUrl: "not-a-url" }] }).success,
    false
  );
  // Over the per-item alt cap.
  assert.equal(
    customGallerySettingsSchema.safeParse({
      images: [{ imageUrl: "https://cdn.example.com/a.jpg", alt: "x".repeat(CUSTOM_GALLERY_ALT_MAX + 1) }],
    }).success,
    false
  );
  // Over the image count cap.
  assert.equal(
    customGallerySettingsSchema.safeParse({
      images: Array.from({ length: CUSTOM_GALLERY_IMAGES_MAX + 1 }, () => ({
        imageUrl: "https://cdn.example.com/a.jpg",
      })),
    }).success,
    false
  );
});

test("parseCustomRichSettings returns {} for absent/malformed", () => {
  assert.deepEqual(parseCustomRichSettings(undefined), {});
  assert.deepEqual(parseCustomRichSettings(null), {});
  assert.deepEqual(parseCustomRichSettings({ heading: "x".repeat(999) }), {});
  assert.deepEqual(parseCustomRichSettings({ heading: "Hi", body: "There" }), {
    heading: "Hi",
    body: "There",
  });
});

test("parseCustomImageSettings returns {} for absent/malformed", () => {
  assert.deepEqual(parseCustomImageSettings(undefined), {});
  assert.deepEqual(parseCustomImageSettings({ imageUrl: "javascript:alert(1)" }), {});
  assert.deepEqual(
    parseCustomImageSettings({ imageUrl: "https://cdn.example.com/a.jpg", caption: "Hi" }),
    { imageUrl: "https://cdn.example.com/a.jpg", caption: "Hi" }
  );
});

test("parseCustomGallerySettings returns {} for absent/malformed", () => {
  assert.deepEqual(parseCustomGallerySettings(undefined), {});
  assert.deepEqual(parseCustomGallerySettings({ images: [{ alt: "no url" }] }), {});
  assert.deepEqual(
    parseCustomGallerySettings({ images: [{ imageUrl: "https://cdn.example.com/a.jpg" }] }),
    { images: [{ imageUrl: "https://cdn.example.com/a.jpg" }] }
  );
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

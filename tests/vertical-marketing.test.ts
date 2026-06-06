/**
 * Phase 2b — VerticalConfig.marketing content is the source of truth
 * for the dynamic /<vertical> landing page. A regression that strips
 * a required field would manifest as a runtime undefined-render or a
 * blank metadata tag, so we pin the contract here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { listVerticals } from "../lib/verticals/registry.ts";

test("every vertical has non-empty seoTitle and seoDescription", () => {
  for (const v of listVerticals()) {
    assert.ok(v.marketing.seoTitle.length > 0, `${v.slug}: seoTitle empty`);
    assert.ok(
      v.marketing.seoDescription.length > 0,
      `${v.slug}: seoDescription empty`,
    );
    // Google truncates description ~160 chars — flag any that go long
    assert.ok(
      v.marketing.seoDescription.length <= 200,
      `${v.slug}: seoDescription longer than 200 chars (Google will truncate)`,
    );
  }
});

test("every vertical has heroKicker, heroHeadline, and heroSubhead", () => {
  for (const v of listVerticals()) {
    assert.ok(v.marketing.heroKicker.length > 0, `${v.slug}: heroKicker empty`);
    assert.ok(v.marketing.heroHeadline.length > 0, `${v.slug}: heroHeadline empty`);
    assert.ok(v.marketing.heroSubhead.length > 0, `${v.slug}: heroSubhead empty`);
  }
});

test("every vertical has 4–6 feature cards (template-renderable)", () => {
  for (const v of listVerticals()) {
    const n = v.marketing.features.length;
    assert.ok(
      n >= 4 && n <= 6,
      `${v.slug}: expected 4–6 features, got ${n}`,
    );
    for (const f of v.marketing.features) {
      assert.ok(f.title.length > 0, `${v.slug}: feature title empty`);
      assert.ok(f.body.length > 0, `${v.slug}: feature body empty`);
    }
  }
});

test("every vertical has a hero image path that looks like a URL/asset", () => {
  for (const v of listVerticals()) {
    const hero = v.imageSlugs.hero;
    assert.ok(
      hero.startsWith("/") || hero.startsWith("http"),
      `${v.slug}: imageSlugs.hero must start with / or http (got "${hero}")`,
    );
  }
});

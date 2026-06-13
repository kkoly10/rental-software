/**
 * Onboarding vertical chooser — registry is the single source of truth.
 *
 * The signup wizard's vertical cards are now built from the vertical
 * registry (app/onboarding/page.tsx → buildVerticalOptions), and the
 * server action (lib/onboarding/actions.ts) validates the submission
 * against listVerticalSlugs(). So the old drift risk — the i18n option
 * list disagreeing with the action's hardcoded allowlist — is gone by
 * construction. This test pins the registry itself: the expected
 * day-one 6 verticals, and that each carries the fields the wizard card
 * renders (label.en, a non-empty category seed list, and a policy).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { listVerticals, listVerticalSlugs } from "../lib/verticals/registry.ts";

const EXPECTED = [
  "inflatable",
  "tents",
  "tables-and-chairs",
  "dance-floors",
  "photo-booths",
  "concessions",
].sort();

test("registry exposes exactly the day-one 6 verticals", () => {
  assert.deepEqual([...listVerticalSlugs()].sort(), EXPECTED);
});

test("the dead legacy car/equipment verticals are gone from the registry", () => {
  const slugs = listVerticalSlugs();
  assert.ok(!slugs.includes("car"), "car should no longer be a vertical");
  assert.ok(!slugs.includes("equipment"), "equipment should no longer be a vertical");
});

test("every vertical carries the fields the signup card renders", () => {
  for (const v of listVerticals()) {
    assert.ok(v.label.en.length > 0, `${v.slug} missing label.en`);
    assert.ok(
      v.defaultCategorySeeds.length > 0,
      `${v.slug} has no default category seeds for the card preview`,
    );
    assert.ok(
      Number.isFinite(v.policies.minLeadTimeHours),
      `${v.slug} missing a lead-time policy`,
    );
  }
});

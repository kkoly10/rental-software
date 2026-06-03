/**
 * Sprint 5.8 — onboarding vertical chooser allowlist pin.
 *
 * Two surfaces have to agree on which verticals exist:
 *   - the i18n options the chooser renders (en/es/fr/pt)
 *   - the server action allowlist that validates the form submission
 *
 * If they drift — someone adds "boat" to en.ts but forgets the action,
 * or adds a vertical to the action but forgets es/fr/pt — the form
 * silently funnels the operator into the wrong category seed. This
 * test re-states both lists and pins them equal.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { en } from "../lib/i18n/messages/en.ts";
import { es } from "../lib/i18n/messages/es.ts";
import { fr } from "../lib/i18n/messages/fr.ts";
import { pt } from "../lib/i18n/messages/pt.ts";

// Duplicated from lib/onboarding/actions.ts. Source of truth lives there;
// this is the safety net.
const ACTION_ALLOWED = ["inflatable", "car", "equipment"] as const;

test("every locale exposes the same vertical options as the action accepts", () => {
  for (const [locale, messages] of [
    ["en", en],
    ["es", es],
    ["fr", fr],
    ["pt", pt],
  ] as const) {
    const options = messages.onboarding.form.businessType.options;
    const localeKeys = Object.keys(options).sort();
    assert.deepEqual(
      localeKeys,
      [...ACTION_ALLOWED].sort(),
      `locale ${locale} options drifted from action allowlist`,
    );
  }
});

test("each vertical option has a non-empty label + description in every locale", () => {
  for (const [locale, messages] of [
    ["en", en],
    ["es", es],
    ["fr", fr],
    ["pt", pt],
  ] as const) {
    const options = messages.onboarding.form.businessType.options;
    for (const vertical of ACTION_ALLOWED) {
      const opt = options[vertical];
      assert.ok(
        opt.label.length > 0,
        `${locale}.${vertical}.label is empty`,
      );
      assert.ok(
        opt.description.length > 0,
        `${locale}.${vertical}.description is empty`,
      );
    }
  }
});

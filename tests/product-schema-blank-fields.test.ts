/**
 * Pins createProductSchema's parse contract for the
 * brand-new-operator save: name + base price + category +
 * description + is_active filled, every capability field blank.
 *
 * Regression guard for the unitLabel-rejects-undefined trap that
 * shipped to prod and blocked Stage 3c of the inflatable vertical
 * walkthrough — see docs/qa/vertical-walkthroughs.md. Any new
 * capability field that uses `optionalText(...)` without the outer
 * `.optional()` AND has a reader that returns undefined for blank
 * input will fail this test with the bare Zod "Required" message.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createProductSchema } from "../lib/validation/products.ts";

test("createProductSchema accepts a minimal blank-capabilities save", () => {
  const parsed = createProductSchema.safeParse({
    name: "Bouncy Castle",
    categoryId: "00000000-0000-0000-0000-000000000001",
    basePrice: "165",
    securityDeposit: "0",
    shortDescription: "",
    description: "Classic 13×13 castle inflatable.",
    requiresDelivery: true,
    isActive: true,
    visibility: "public",
    // inflatable setup — readInflatableSetupFields returns undefined
    // for blank inputs
    supportsModes: undefined,
    anchoringMethods: [],
    wetUpcharge: undefined,
    requiredAnchorCount: undefined,
    // capability shapes — every reader returns undefined for blank
    capabilitySlugs: [],
    hourlyRate: undefined,
    minimumHours: undefined,
    idleHourRate: undefined,
    unitPrice: undefined,
    unitLabel: undefined,
    setupMinutesBefore: undefined,
    attendantIncludedHours: undefined,
    attendantOverageRate: undefined,
    capacityMetric: undefined,
    capacityValue: undefined,
    minimumOrderQuantity: undefined,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    assert.fail(`Expected parse to succeed.\n  ${issues}`);
  }
});

import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

/**
 * Tier-2 launch hardening — accessibility coverage on the customer
 * checkout and the operator order detail pages. WCAG 2.1 AA is
 * table-stakes for B2B SaaS, and the audit flagged that neither
 * surface had ever been scanned. We assert only color-contrast,
 * label/name associations, and ARIA-required attributes as hard
 * failures — the rules most likely to actually block disabled users
 * from completing a task — and surface every other rule's findings
 * in the test annotation so they're visible without failing CI on
 * cosmetic noise.
 *
 * Pass an explicit `name` so the test report distinguishes scans
 * across multiple pages in one test.
 */
const FAIL_RULES = new Set([
  "color-contrast",
  "label",
  "label-title-only",
  "form-field-multiple-labels",
  "aria-required-attr",
  "aria-required-children",
  "aria-required-parent",
  "aria-valid-attr-value",
  "aria-valid-attr",
  "aria-input-field-name",
  "aria-toggle-field-name",
  "button-name",
  "link-name",
  "input-button-name",
  "input-image-alt",
  "duplicate-id-active",
  "html-has-lang",
]);

export async function expectNoSeriousA11yViolations(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  const failing = results.violations.filter((v) => FAIL_RULES.has(v.id));
  const advisory = results.violations.filter((v) => !FAIL_RULES.has(v.id));

  testInfo.annotations.push({
    type: "a11y",
    description: `${name}: ${failing.length} blocking, ${advisory.length} advisory`,
  });

  if (advisory.length > 0) {
    testInfo.annotations.push({
      type: "a11y-advisory",
      description: `${name}: ${advisory.map((v) => v.id).join(", ")}`,
    });
  }

  if (failing.length > 0) {
    const summary = failing
      .map(
        (v) =>
          `  • ${v.id} (${v.impact ?? "?"}): ${v.help} — ${v.nodes.length} node(s)`,
      )
      .join("\n");
    expect(
      failing,
      `${name} carries blocking a11y violations:\n${summary}`,
    ).toEqual([]);
  }
}

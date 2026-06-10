import { test, expect } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./a11y-helpers";

/**
 * Tier-2 launch hardening — crew mobile view on a phone.
 *
 * Crew works from the field; a layout bug here strands a driver
 * mid-route. The desktop walkthrough's Stage 7b-v only proved the
 * page renders without a 500. This spec loads it in an iPhone
 * viewport and asserts:
 *   • the page renders (no 500)
 *   • the layout doesn't overflow horizontally (no pinch-zoom)
 *   • no blocking a11y violations (color-contrast on a phone outdoors
 *     in sun is a real ergonomic concern)
 *
 * Uses the operator's storageState — same auth the dashboard relies
 * on. Real crew accounts would carry a `crew` role; the operator role
 * also sees /crew/today so the test works without a separate seed.
 */
test.describe("Mobile crew today view (iPhone 13)", () => {
  test("crew /today renders + fits the viewport + scans clean", async ({
    page,
  }, testInfo) => {
    await page.goto("/crew/today");
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });

    // No 500 / generic application-error shell.
    const body = await page.locator("body").innerText();
    expect(/500|application error|internal server error/i.test(body)).toBeFalsy();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(
      overflow,
      `/crew/today overflows the viewport by ${overflow}px`,
    ).toBeLessThanOrEqual(2);

    await expectNoSeriousA11yViolations(page, testInfo, "crew today");
  });
});

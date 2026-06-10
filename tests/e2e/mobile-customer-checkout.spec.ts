import { test, expect } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./a11y-helpers";

/**
 * Tier-2 launch hardening — the customer storefront on a phone.
 *
 * The desktop walkthrough proved the booking form works in a 1280px
 * Chrome window. Customers don't book from a desktop. This spec
 * loads the same flow in an iPhone-13 viewport (390×844), walks the
 * checkout form to the in-page "Booking submitted" banner, and runs
 * an axe-core accessibility scan on each page along the way. Hard
 * failures are limited to the WCAG rules that actually stop a
 * disabled user from completing a task (color-contrast, missing
 * labels, broken ARIA); the rest land as advisory annotations.
 */
const STOREFRONT_HOST = process.env.E2E_STOREFRONT_HOST ?? "couranr.korent.app";
const SERVICE_AREA_ZIP = process.env.E2E_SERVICE_AREA_ZIP ?? "22554";
const PRODUCT_SLUG = process.env.E2E_PRODUCT_SLUG ?? "e2e-13ft-castle-bouncer";

// Anonymous storefront — no auth cookie wanted.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Mobile customer checkout (iPhone 13)", () => {
  test("PDP loads + carries Book Now CTA + scans clean", async ({ page }, testInfo) => {
    await page.goto(`https://${STOREFRONT_HOST}/inventory/${PRODUCT_SLUG}`);
    // No networkidle — the storefront keeps a Vercel Live socket
    // open and the wait burns its full timeout for nothing.
    await expect(
      page.getByText(/book now|add to cart/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousA11yViolations(page, testInfo, "storefront PDP");
  });

  test("checkout form fits the viewport + submits + scans clean", async ({
    page,
  }, testInfo) => {
    const future = new Date();
    future.setDate(future.getDate() + 50 + (Date.now() % 30));
    const eventDate = future.toISOString().slice(0, 10);
    const params = new URLSearchParams({
      product: PRODUCT_SLUG,
      date: eventDate,
      zip: SERVICE_AREA_ZIP,
    });
    await page.goto(
      `https://${STOREFRONT_HOST}/checkout?${params.toString()}`,
    );
    await expect(
      page.getByRole("heading", { name: /complete your booking/i }),
    ).toBeVisible({ timeout: 15_000 });

    // No horizontal overflow — a common mobile sin where a form input
    // pushes the layout wider than the viewport and the customer has
    // to pinch-zoom-scroll to find every field.
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(
      overflow,
      `checkout form overflows the viewport by ${overflow}px (mobile users have to horizontally scroll)`,
    ).toBeLessThanOrEqual(2);

    await expectNoSeriousA11yViolations(page, testInfo, "checkout form");

    // Drive the booking through to the in-page success banner.
    await page.fill('input[name="first_name"]', "Mobile");
    await page.fill('input[name="last_name"]', "Tester");
    await page.fill('input[name="phone"]', "5555550101");
    await page.fill('input[name="email"]', "e2e+mobile@example.test");
    await page.fill('input[name="line1"]', "1 Main St");
    await page.fill('input[name="city"]', "Stafford");
    await page.fill('input[name="state"]', "VA");
    await page.fill('input[name="postal_code"]', SERVICE_AREA_ZIP);
    await page.locator('input[name="terms_accepted"]').check();
    await page.locator('button[type="submit"]').first().click();

    await expect(page.getByText(/booking submitted/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText(/order ORD-\d+-[A-F0-9]+ created/i),
    ).toBeVisible();

    // Scan the success state too — the banner is the moment the
    // customer reads the confirmation message and tries to follow
    // the "view order details" link.
    await expectNoSeriousA11yViolations(
      page,
      testInfo,
      "checkout success banner",
    );
  });
});

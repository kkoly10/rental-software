import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Inflatable vertical end-to-end walkthrough.
 *
 * Drives the operator account (komlankouhiko@icloud.com →
 * "Couranr LLC") through every stage a brand-new inflatable
 * operator would hit. The account is reset to a "just-onboarded"
 * state (0 products / orders / customers, 5 default inflatable
 * categories preserved) before each run via the Supabase MCP, so
 * the empty-state copy + starter-example surfaces all fire.
 *
 * Stops BEFORE Stripe redirect because Stripe isn't configured for
 * the test org yet — the payment-flow walk lands in a follow-up.
 */

const RUN_ID = process.env.E2E_RUN_ID ?? `${Date.now().toString(36)}`;
const SCREENSHOTS = `playwright-e2e-report/inflatable-${RUN_ID}`;

// Create the screenshot dir up front so the first page.screenshot()
// in the run doesn't ENOENT.
mkdirSync(SCREENSHOTS, { recursive: true });

const OPERATOR_EMAIL = process.env.E2E_INFLATABLE_OPERATOR_EMAIL;
const OPERATOR_PASSWORD = process.env.E2E_INFLATABLE_OPERATOR_PASSWORD;

test.describe("Inflatable — fresh operator journey", () => {
  test("Stage 1 (anonymous): marketing → signup form", async ({ page }) => {
    await page.goto("/inflatable-rental-software");
    await expect(page).toHaveTitle(/Inflatable/i);
    await page.screenshot({ path: `${SCREENSHOTS}/01-marketing.png`, fullPage: true });

    const signupLink = page.locator('a[href*="/signup"]').first();
    await expect(signupLink).toBeVisible();
    await signupLink.click();
    await expect(page).toHaveURL(/\/signup/);
    await page.screenshot({ path: `${SCREENSHOTS}/02-signup-form.png`, fullPage: true });

    // Don't actually submit — we use the existing test account
    // for the rest of the walk.
  });

  test.describe("authenticated journey", () => {
    test.skip(
      !OPERATOR_EMAIL || !OPERATOR_PASSWORD,
      "Needs E2E_INFLATABLE_OPERATOR_EMAIL + E2E_INFLATABLE_OPERATOR_PASSWORD env vars",
    );

    test("Stage 2: login → dashboard shows empty state", async ({ page }) => {
      await page.goto("/login");
      await page.fill('input[name="email"]', OPERATOR_EMAIL!);
      await page.fill('input[name="password"]', OPERATOR_PASSWORD!);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });
      await page.screenshot({ path: `${SCREENSHOTS}/03-dashboard-home.png`, fullPage: true });

      const bodyText = await page.locator("body").innerText();
      expect(/500|application error|internal server error/i.test(bodyText)).toBeFalsy();
    });

    test("Stage 3a: /dashboard/products shows vertical-specific empty state", async ({ page }) => {
      await loginIfNeeded(page);
      await page.goto("/dashboard/products");
      await page.screenshot({ path: `${SCREENSHOTS}/04-products-empty.png`, fullPage: true });

      // After the reset this org has 0 products. The empty state
      // copy from #289 / #293 should fire — "No bouncers yet."
      const empty = page.getByText(/no bouncers yet/i);
      await expect(empty).toBeVisible();
    });

    test("Stage 3b: /dashboard/products/new shows starter example", async ({ page }) => {
      await loginIfNeeded(page);
      await page.goto("/dashboard/products/new");
      await page.screenshot({ path: `${SCREENSHOTS}/05-new-product-banner.png`, fullPage: true });

      // Starter card from #290 should be visible on a fresh org.
      const starter = page.getByText(/13ft Castle Bouncer/i);
      await expect(starter).toBeVisible();
    });

    test("Stage 3c: operator creates their first product", async ({ page }) => {
      await loginIfNeeded(page);
      await page.goto("/dashboard/products/new");

      // Fill in the bouncer-the-starter-example-suggests + submit.
      await page.fill('input[name="name"]', "[E2E] 13ft Castle Bouncer");
      await page.fill('input[name="base_price"]', "165");

      // Pick the Bounce Houses category from the seeded defaults.
      const categorySelect = page.locator('select[name="category_id"]');
      const categoryOptions = await categorySelect.locator("option").allTextContents();
      const bounceHouseIndex = categoryOptions.findIndex((t) => /bounce/i.test(t));
      if (bounceHouseIndex > 0) {
        await categorySelect.selectOption({ index: bounceHouseIndex });
      }

      const description = page.locator('textarea[name="description"]');
      if (await description.count() > 0) {
        await description.fill(
          "Classic 13×13 castle inflatable for kids ages 3-10. Stakes + blower + safety overview included.",
        );
      }

      // Active checkbox if not already checked
      const activeCheckbox = page.locator('input[name="is_active"]');
      if (await activeCheckbox.count() > 0) {
        await activeCheckbox.check();
      }

      await page.screenshot({ path: `${SCREENSHOTS}/06-new-product-form-filled.png`, fullPage: true });

      // Submit.
      await page.locator('button[type="submit"]').first().click();

      // Settle. Don't assume redirect — the action might return an
      // error and keep us on /new. Capture both URL + any visible
      // error text so we can diagnose.
      await page.waitForLoadState("networkidle", { timeout: 10_000 });
      await page.screenshot({ path: `${SCREENSHOTS}/07-after-submit.png`, fullPage: true });

      const finalUrl = page.url();
      const errorBanner = page.locator('[role="alert"], .field-error, .form-error');
      const errorTextCount = await errorBanner.count();
      const errorText =
        errorTextCount > 0 ? await errorBanner.first().innerText() : "(none)";

      test.info().annotations.push({
        type: "result",
        description: `Final URL: ${finalUrl}`,
      });
      test.info().annotations.push({
        type: "result",
        description: `Error text: ${errorText}`,
      });

      // Hard fail if we stayed on /new — the operator's first save
      // bombed silently otherwise.
      expect(
        finalUrl,
        `Form stayed on /new — likely a validation error: ${errorText}`,
      ).not.toMatch(/\/products\/new/);
    });

    test("Stage 4: storefront PDP renders the new product anonymously", async ({ browser }) => {
      // Brand-new context = no auth cookie, simulates a customer.
      const customerContext = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await customerContext.newPage();

      const storefrontHost = "couranr.korent.app";
      await page.goto(`https://${storefrontHost}/inventory`);
      await page.screenshot({ path: `${SCREENSHOTS}/08-storefront-catalog.png`, fullPage: true });

      // Find the new product link.
      const productLink = page.locator('a[href*="/inventory/"]').first();
      await expect(productLink).toBeVisible({ timeout: 10_000 });

      await productLink.click();
      await page.screenshot({ path: `${SCREENSHOTS}/09-storefront-pdp.png`, fullPage: true });

      // PDP should show price + Book Now CTA.
      await expect(page.getByText(/book now|add to cart/i).first()).toBeVisible();

      await customerContext.close();
    });

    test("Stage 5: dashboard sub-pages render without 500s", async ({ page }) => {
      await loginIfNeeded(page);

      const subPages = [
        "/dashboard/orders",
        "/dashboard/calendar",
        "/dashboard/customers",
        "/dashboard/deliveries",
        "/dashboard/messages",
        "/dashboard/pricing",
        "/dashboard/service-areas",
        "/dashboard/maintenance",
        "/dashboard/payments",
        "/dashboard/documents",
        "/dashboard/analytics",
        "/dashboard/website",
        "/dashboard/settings",
        "/dashboard/settings/team",
        "/dashboard/settings/billing",
      ];

      for (const path of subPages) {
        await page.goto(path);
        const safeName = path.replace(/\//g, "-").replace(/^-/, "");
        await page.screenshot({ path: `${SCREENSHOTS}/10-sub-${safeName}.png` });

        const bodyText = await page.locator("body").innerText();
        expect(
          /500|application error|internal server error/i.test(bodyText),
          `${path} returned a 500 — see screenshot ${safeName}.png`,
        ).toBeFalsy();
      }
    });
  });
});

/**
 * Best-effort login if the current page isn't already inside the
 * dashboard. Saves logging in once per test; Playwright spec
 * scopes don't share storage state across tests by default.
 */
async function loginIfNeeded(page: import("@playwright/test").Page) {
  if (page.url().includes("/dashboard")) return;
  await page.goto("/login");
  await page.fill('input[name="email"]', OPERATOR_EMAIL!);
  await page.fill('input[name="password"]', OPERATOR_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });
}

import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Parameterized fresh-operator journey — one definition, six
 * verticals. Each tests/e2e/<vertical>.spec.ts is a thin wrapper
 * that passes its VerticalJourneyConfig; the stages themselves are
 * identical because the product form, orders flow, and storefront
 * are vertical-agnostic (only copy + categories + starter examples
 * differ).
 *
 * PRE-REQS per run:
 *  - The operator org is reset to just-onboarded state
 *    (scripts/e2e-reset-org.mjs) AND flipped to this vertical:
 *    organizations.business_type + the organization_verticals
 *    primary row + the 5 default categories from the registry.
 *  - E2E_OPERATOR_EMAIL / E2E_OPERATOR_PASSWORD env vars (the
 *    legacy E2E_INFLATABLE_OPERATOR_* names still work).
 *
 * Stops BEFORE Stripe redirect — deposit flow lands once Stripe is
 * configured for the test org.
 */

export type VerticalJourneyConfig = {
  /** Registry slug — used for screenshot dir naming only. */
  vertical: string;
  /** Marketing landing path, e.g. "/tent-rental-software". */
  marketingPath: string;
  /** Asserted against the landing page <title>. */
  marketingTitle: RegExp;
  /** Empty-state heading on /dashboard/products for a fresh org. */
  emptyProductsCopy: RegExp;
  /** Starter-example product name shown on /dashboard/products/new. */
  starterName: RegExp;
  /** Category option to pick in the product form. */
  categoryPattern: RegExp;
  /** Product the operator creates (E2E-prefixed for easy cleanup). */
  productName: string;
  productPrice: string;
  productDescription: string;
  /** Slug the create action derives from productName (slugify). */
  productSlug: string;
  /**
   * Subtotal the operator types into the manual order form (Stage 6).
   * Defaults to productPrice — override for per-unit verticals where
   * a realistic event order is many units (e.g. 100 chairs = $350),
   * otherwise the $50 deposit exceeds the total and the schema
   * rightly rejects it.
   */
  orderSubtotal?: string;
  /**
   * When true, Stage 4b asserts the service-area minimum-order
   * rejection instead of a successful booking. Single-unit prices in
   * per-unit verticals (a $3.50 chair) sit below the org's $100
   * minimum, and the storefront deep-link can't express quantity
   * without the pricing.per-unit capability — so the correct
   * behavior IS the rejection. Covers the "below minimum order"
   * edge-case row of the QA matrix.
   */
  checkoutBelowMinimum?: boolean;
};

const OPERATOR_EMAIL =
  process.env.E2E_OPERATOR_EMAIL ?? process.env.E2E_INFLATABLE_OPERATOR_EMAIL;
const OPERATOR_PASSWORD =
  process.env.E2E_OPERATOR_PASSWORD ??
  process.env.E2E_INFLATABLE_OPERATOR_PASSWORD;
const VERCEL_BYPASS_TOKEN = process.env.E2E_VERCEL_BYPASS_TOKEN;

/** Tenant storefront host — the customer-facing legs always hit prod
 *  because tenant resolution is Host-header based and previews can't
 *  serve the subdomain. */
const STOREFRONT_HOST = process.env.E2E_STOREFRONT_HOST ?? "couranr.korent.app";

/** ZIP inside the org's configured service area (label "Primary"). */
const SERVICE_AREA_ZIP = process.env.E2E_SERVICE_AREA_ZIP ?? "22554";

export function defineVerticalJourney(config: VerticalJourneyConfig) {
  const RUN_ID = process.env.E2E_RUN_ID ?? `${Date.now().toString(36)}`;
  const SCREENSHOTS = `playwright-e2e-report/${config.vertical}-${RUN_ID}`;
  mkdirSync(SCREENSHOTS, { recursive: true });

  test.describe(`${config.vertical} — fresh operator journey`, () => {
    test.describe("anonymous", () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      test.beforeEach(async ({ page, baseURL }) => {
        if (VERCEL_BYPASS_TOKEN && baseURL) {
          await page.goto(`${baseURL}/?_vercel_share=${VERCEL_BYPASS_TOKEN}`);
        }
      });

      test("Stage 1: marketing → signup form", async ({ page }) => {
        await page.goto(config.marketingPath);
        await expect(page).toHaveTitle(config.marketingTitle);
        await page.screenshot({ path: `${SCREENSHOTS}/01-marketing.png`, fullPage: true });

        const signupLink = page.locator('a[href*="/signup"]').first();
        await expect(signupLink).toBeVisible();
        await signupLink.click();
        await expect(page).toHaveURL(/\/signup/);
        await page.screenshot({ path: `${SCREENSHOTS}/02-signup-form.png`, fullPage: true });
      });
    });

    test.describe("authenticated journey", () => {
      test.skip(
        !OPERATOR_EMAIL || !OPERATOR_PASSWORD,
        "Needs E2E_OPERATOR_EMAIL + E2E_OPERATOR_PASSWORD env vars",
      );

      // Shared storageState from global-setup logs the operator in
      // for every test in this group — no per-test login.

      test("Stage 2: dashboard loads without error", async ({ page }) => {
        await page.goto("/dashboard");
        await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });
        await page.screenshot({ path: `${SCREENSHOTS}/03-dashboard-home.png`, fullPage: true });

        const bodyText = await page.locator("body").innerText();
        expect(/500|application error|internal server error/i.test(bodyText)).toBeFalsy();
      });

      test("Stage 3a: /dashboard/products shows vertical-specific empty state", async ({ page }) => {
        await page.goto("/dashboard/products");
        await page.screenshot({ path: `${SCREENSHOTS}/04-products-empty.png`, fullPage: true });

        await expect(page.getByText(config.emptyProductsCopy)).toBeVisible();
      });

      test("Stage 3b: /dashboard/products/new shows starter example", async ({ page }) => {
        await page.goto("/dashboard/products/new");
        await page.screenshot({ path: `${SCREENSHOTS}/05-new-product-banner.png`, fullPage: true });

        // .first() — for some verticals the starter name also appears
        // as a category option in the form (e.g. "Popcorn Machine"),
        // which would otherwise trip Playwright's strict mode.
        await expect(page.getByText(config.starterName).first()).toBeVisible();
      });

      test("Stage 3c: operator creates their first product", async ({ page }) => {
        await page.goto("/dashboard/products/new");

        await page.fill('input[name="name"]', config.productName);
        await page.fill('input[name="base_price"]', config.productPrice);

        const categorySelect = page.locator('select[name="category_id"]');
        const categoryOptions = await categorySelect.locator("option").allTextContents();
        const categoryIndex = categoryOptions.findIndex((t) => config.categoryPattern.test(t));
        expect(
          categoryIndex,
          `no category matching ${config.categoryPattern} — did the vertical flip reseed categories?`,
        ).toBeGreaterThan(0);
        await categorySelect.selectOption({ index: categoryIndex });

        const description = page.locator('textarea[name="description"]');
        if ((await description.count()) > 0) {
          await description.fill(config.productDescription);
        }

        const activeCheckbox = page.locator('input[name="is_active"]');
        if ((await activeCheckbox.count()) > 0) {
          await activeCheckbox.check();
        }

        await page.screenshot({ path: `${SCREENSHOTS}/06-new-product-form-filled.png`, fullPage: true });
        await page.locator('button[type="submit"]').first().click();
        await page.waitForLoadState("networkidle", { timeout: 10_000 });
        await page.screenshot({ path: `${SCREENSHOTS}/07-after-submit.png`, fullPage: true });

        const finalUrl = page.url();
        const errorBanner = page.locator('[role="alert"], .field-error, .form-error');
        const errorText =
          (await errorBanner.count()) > 0 ? await errorBanner.first().innerText() : "(none)";
        expect(
          finalUrl,
          `Form stayed on /new — likely a validation error: ${errorText}`,
        ).not.toMatch(/\/products\/new/);
      });

      test("Stage 3d: operator uploads a product image", async ({ page }) => {
        await page.goto("/dashboard/products");
        const productRow = page
          .getByRole("link", { name: new RegExp(escapeRegex(config.productName.replace(/^\[E2E\] /, "")), "i") })
          .first();
        if (!(await productRow.isVisible().catch(() => false))) {
          await page.reload();
        }
        await expect(productRow).toBeVisible({ timeout: 15_000 });
        // Navigate via href, not click() — the dismissable banner on
        // /dashboard/products has intercepted row clicks before.
        const productHref = await productRow.getAttribute("href");
        expect(productHref).toBeTruthy();
        await page.goto(productHref!);
        await page.waitForLoadState("networkidle", { timeout: 10_000 });
        await page.screenshot({ path: `${SCREENSHOTS}/06b-product-detail.png`, fullPage: true });

        // 1×1 transparent PNG — no on-disk fixture needed.
        const pngBuffer = Buffer.from(
          "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489" +
            "0000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082",
          "hex",
        );
        await page
          .locator('input[name="image_file"]')
          .setInputFiles({ name: "e2e-product.png", mimeType: "image/png", buffer: pngBuffer });
        await page.fill('input[name="alt_text"]', `${config.productName} — set up for an event`);
        await page
          .locator('form:has(input[name="image_file"]) button[type="submit"]')
          .click();
        // 45s — the upload action sharpens + stores the image, and a
        // cold serverless instance on prod has been observed to take
        // longer than the original 15s budget.
        await expect(page.getByText(/image uploaded successfully/i)).toBeVisible({
          timeout: 45_000,
        });
        await page.screenshot({ path: `${SCREENSHOTS}/06c-image-uploaded.png`, fullPage: true });
      });

      test("Stage 4: storefront PDP renders the new product anonymously", async ({ browser }) => {
        const customerContext = await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await customerContext.newPage();

        await page.goto(`https://${STOREFRONT_HOST}/inventory`);
        await page.screenshot({ path: `${SCREENSHOTS}/08-storefront-catalog.png`, fullPage: true });

        const productLink = page.locator('a[href*="/inventory/"]').first();
        await expect(productLink).toBeVisible({ timeout: 10_000 });
        await productLink.click();
        await page.screenshot({ path: `${SCREENSHOTS}/09-storefront-pdp.png`, fullPage: true });

        await expect(page.getByText(/book now|add to cart/i).first()).toBeVisible();
        await customerContext.close();
      });

      test("Stage 4b: customer completes the booking form past Book Now", async ({ browser }) => {
        const customerContext = await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await customerContext.newPage();

        const future = new Date();
        future.setDate(future.getDate() + 21);
        const eventDate = future.toISOString().slice(0, 10);
        const params = new URLSearchParams({
          product: config.productSlug,
          date: eventDate,
          zip: SERVICE_AREA_ZIP,
        });
        await page.goto(`https://${STOREFRONT_HOST}/checkout?${params.toString()}`);
        await page.screenshot({ path: `${SCREENSHOTS}/10-checkout-form.png`, fullPage: true });

        await page.fill('input[name="first_name"]', "Avery");
        await page.fill('input[name="last_name"]', "Chen");
        await page.fill('input[name="phone"]', "5555550199");
        await page.fill('input[name="email"]', "e2e+customer@example.test");
        await page.fill('input[name="line1"]', "742 Evergreen Terrace");
        await page.fill('input[name="city"]', "Stafford");
        await page.fill('input[name="state"]', "VA");
        await page.fill('input[name="postal_code"]', SERVICE_AREA_ZIP);
        await page.locator('input[name="terms_accepted"]').check();
        await page.screenshot({ path: `${SCREENSHOTS}/10b-checkout-filled.png`, fullPage: true });

        await page.locator('button[type="submit"]').first().click();
        await page.waitForLoadState("networkidle", { timeout: 20_000 });
        await page.screenshot({ path: `${SCREENSHOTS}/10c-checkout-after-submit.png`, fullPage: true });

        if (config.checkoutBelowMinimum) {
          // Single-unit price sits below the service-area minimum —
          // the correct outcome is the rejection alert.
          await expect(
            page.getByText(/requires a minimum order/i),
          ).toBeVisible({ timeout: 10_000 });
        } else {
          // Stripe isn't configured → $0 deposit → in-page success
          // banner with the new order number instead of a redirect.
          await expect(page.getByText(/booking submitted/i)).toBeVisible({ timeout: 10_000 });
          await expect(page.getByText(/order ORD-\d+-[A-F0-9]+ created/i)).toBeVisible();
        }
        await customerContext.close();
      });

      test("Stage 6: operator creates a draft order on behalf of a phone-in customer", async ({ page }) => {
        await page.goto("/dashboard/orders/new");
        await page.screenshot({ path: `${SCREENSHOTS}/11-new-order-empty.png`, fullPage: true });

        const future = new Date();
        future.setDate(future.getDate() + 14);
        const eventDate = future.toISOString().slice(0, 10);

        await page.fill('input[name="first_name"]', "Jordan");
        await page.fill('input[name="last_name"]', "Rivera");
        await page.fill('input[name="phone"]', "555-0142");
        await page.fill('input[name="event_date"]', eventDate);

        const productSelect = page.locator('select[name="product_id"]');
        const productOptions = await productSelect.locator("option").allTextContents();
        const fragment = config.productName.replace(/^\[E2E\] /, "");
        const productIndex = productOptions.findIndex((t) =>
          new RegExp(escapeRegex(fragment), "i").test(t),
        );
        expect(productIndex, "newly-created product wasn't in the dropdown").toBeGreaterThan(0);
        await productSelect.selectOption({ index: productIndex });

        await page.fill('input[name="subtotal"]', config.orderSubtotal ?? config.productPrice);
        await page.fill('input[name="deposit_amount"]', "50");

        await page.screenshot({ path: `${SCREENSHOTS}/12-new-order-filled.png`, fullPage: true });
        await page.locator('button[type="submit"]').first().click();
        await page.waitForLoadState("networkidle", { timeout: 15_000 });
        await page.screenshot({ path: `${SCREENSHOTS}/13-after-order-submit.png`, fullPage: true });

        const finalUrl = page.url();
        const errorBanner = page.locator('[role="alert"], .field-error, .form-error');
        const errorText =
          (await errorBanner.count()) > 0 ? await errorBanner.first().innerText() : "(none)";
        expect(
          finalUrl,
          `Form stayed on /new — likely a validation error: ${errorText}`,
        ).not.toMatch(/\/orders\/new/);
      });

      test("Stage 7: operator clicks Mark Confirmed and sees the success badge", async ({ page }) => {
        // Inquiry filter excludes the storefront order from Stage 4b
        // (auto-confirmed at $0 deposit) — we want Jordan's draft.
        await page.goto("/dashboard/orders?status=inquiry");
        await page.screenshot({ path: `${SCREENSHOTS}/14-orders-list.png`, fullPage: true });

        const orderLink = page
          .locator('a[href^="/dashboard/orders/"]')
          .filter({ has: page.locator("article") })
          .first();
        await expect(orderLink).toBeVisible({ timeout: 10_000 });
        const orderHref = await orderLink.getAttribute("href");
        expect(orderHref, "expected an inquiry-status order in the list").toBeTruthy();
        await page.goto(orderHref!);
        await page.waitForLoadState("networkidle", { timeout: 10_000 });
        await page.screenshot({ path: `${SCREENSHOTS}/15-order-detail.png`, fullPage: true });

        const confirmBtn = page.getByRole("button", { name: /mark confirmed/i });
        await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
        await confirmBtn.click();

        // The success badge is transient — the component calls
        // router.refresh() on ok=true and the re-rendered server tree
        // unmounts it, sometimes before we can sample it. Assert the
        // durable post-state instead: button gone + status flipped.
        await expect(confirmBtn).toBeHidden({ timeout: 10_000 });
        await expect(page.getByText(/confirmed/i).first()).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ path: `${SCREENSHOTS}/16-after-mark-confirmed.png`, fullPage: true });
      });

      test("Stage 7b: confirm survives a hard reload", async ({ page }) => {
        // DB-truth check for the Mark-Confirmed defensive fix: if the
        // order really flipped, the inquiry filter is empty.
        await page.goto("/dashboard/orders?status=inquiry");
        await expect(
          page.locator('a[href^="/dashboard/orders/"]').filter({ has: page.locator("article") }),
        ).toHaveCount(0, { timeout: 10_000 });
      });

      test("Stage 5: dashboard sub-pages render without 500s", async ({ page }) => {
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
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

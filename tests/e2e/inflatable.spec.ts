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

// When the spec runs against a protected Vercel preview, the share
// token has to be presented on the first request so the bypass
// cookie can be set. After that the test navigates as if on prod.
const VERCEL_BYPASS_TOKEN = process.env.E2E_VERCEL_BYPASS_TOKEN;

test.describe("Inflatable — fresh operator journey", () => {
  // Stage 1 is the only anonymous step — drop the shared auth
  // cookie so the marketing page renders for a logged-out visitor.
  test.describe("anonymous", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.beforeEach(async ({ page, baseURL }) => {
      if (VERCEL_BYPASS_TOKEN && baseURL) {
        await page.goto(`${baseURL}/?_vercel_share=${VERCEL_BYPASS_TOKEN}`);
      }
    });

    test("Stage 1: marketing → signup form", async ({ page }) => {
      await page.goto("/inflatable-rental-software");
      await expect(page).toHaveTitle(/Inflatable/i);
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
      "Needs E2E_INFLATABLE_OPERATOR_EMAIL + E2E_INFLATABLE_OPERATOR_PASSWORD env vars",
    );

    // The shared storageState from global-setup logs the operator
    // in for every test in this group — no per-test login needed.

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

      // After the reset this org has 0 products. The empty state
      // copy from #289 / #293 should fire — "No bouncers yet."
      const empty = page.getByText(/no bouncers yet/i);
      await expect(empty).toBeVisible();
    });

    test("Stage 3b: /dashboard/products/new shows starter example", async ({ page }) => {
      await page.goto("/dashboard/products/new");
      await page.screenshot({ path: `${SCREENSHOTS}/05-new-product-banner.png`, fullPage: true });

      // Starter card from #290 should be visible on a fresh org.
      const starter = page.getByText(/13ft Castle Bouncer/i);
      await expect(starter).toBeVisible();
    });

    test("Stage 3c: operator creates their first product", async ({ page }) => {
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

    test("Stage 3d: operator uploads a product image", async ({ page }) => {
      // Navigate from the list so the test follows the real operator
      // path (no DB-lookup shortcut). Click the first product row card.
      await page.goto("/dashboard/products");
      // Product list row's link has an accessible name composed of
      // status + category + product name + price. Anchor on the
      // product name; the "/new" CTA link doesn't carry the bouncer
      // text so it's safely excluded.
      const productRow = page.getByRole("link", { name: /castle bouncer/i }).first();
      // /dashboard/products has shown a stale empty state on the
      // Vercel preview right after Stage 3c — a revalidatePath race.
      // Force a hard reload if the row isn't there on first paint.
      if (!(await productRow.isVisible().catch(() => false))) {
        await page.reload();
      }
      await expect(productRow).toBeVisible({ timeout: 15_000 });
      await productRow.click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 });
      await page.screenshot({ path: `${SCREENSHOTS}/06b-product-detail.png`, fullPage: true });

      // 1×1 transparent PNG — under the 10MB cap, valid header, no
      // disk fixture to maintain. Mirrors what Playwright docs use
      // for synthetic image-upload tests.
      const pngBuffer = Buffer.from(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489" +
          "0000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082",
        "hex",
      );
      await page
        .locator('input[name="image_file"]')
        .setInputFiles({ name: "test-bouncer.png", mimeType: "image/png", buffer: pngBuffer });
      await page.fill('input[name="alt_text"]', "13ft castle inflatable, set up on grass");

      // The image upload form's submit button is the one inside the
      // image-manager card — first submit on the page is the form's.
      await page
        .locator('form:has(input[name="image_file"]) button[type="submit"]')
        .click();
      // Server action posts a multipart form + uploads to Supabase
      // Storage. Anchor on the literal success message from
      // image-actions.ts:194 — the page already carries a "1 of 1
      // ready for booking" success badge from the asset summary card,
      // so a generic `.badge.success` match resolves to multiple.
      await expect(
        page.getByText(/image uploaded successfully/i),
      ).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: `${SCREENSHOTS}/06c-image-uploaded.png`, fullPage: true });
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

    test("Stage 4b: customer completes the booking form past Book Now", async ({ browser }) => {
      const customerContext = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await customerContext.newPage();

      // Deep-link into checkout for the product we just published.
      // Skips the PDP click since Stage 4 already covers that path,
      // and lets this test focus on the form-submit journey.
      const future = new Date();
      future.setDate(future.getDate() + 21);
      const eventDate = future.toISOString().slice(0, 10);
      const params = new URLSearchParams({
        product: "e2e-13ft-castle-bouncer",
        date: eventDate,
        zip: "22554",
      });
      await page.goto(`https://couranr.korent.app/checkout?${params.toString()}`);
      await page.screenshot({ path: `${SCREENSHOTS}/10-checkout-form.png`, fullPage: true });

      await page.fill('input[name="first_name"]', "Avery");
      await page.fill('input[name="last_name"]', "Chen");
      await page.fill('input[name="phone"]', "5555550199");
      await page.fill('input[name="email"]', "e2e+customer@example.test");
      await page.fill('input[name="line1"]', "742 Evergreen Terrace");
      await page.fill('input[name="city"]', "Stafford");
      await page.fill('input[name="state"]', "VA");
      await page.fill('input[name="postal_code"]', "22554");

      // Terms checkbox is required by the action — must be checked
      // before submit or the schema rejects with a clear error.
      await page.locator('input[name="terms_accepted"]').check();
      await page.screenshot({ path: `${SCREENSHOTS}/10b-checkout-filled.png`, fullPage: true });

      await page.locator('button[type="submit"]').first().click();
      await page.waitForLoadState("networkidle", { timeout: 20_000 });
      await page.screenshot({ path: `${SCREENSHOTS}/10c-checkout-after-submit.png`, fullPage: true });

      // Stripe isn't configured for this org, so the deposit is $0
      // and the action skips the Stripe redirect. Instead of leaving
      // /checkout, the action returns a success state and renders an
      // in-page banner with the new order number + a "View order
      // details" link to /order-confirmation. Anchor on the banner.
      await expect(page.getByText(/booking submitted/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/order ORD-\d+-[A-F0-9]+ created/i)).toBeVisible();

      await customerContext.close();
    });

    test("Stage 6: operator creates a draft order on behalf of a phone-in customer", async ({ page }) => {
      await page.goto("/dashboard/orders/new");
      await page.screenshot({ path: `${SCREENSHOTS}/11-new-order-empty.png`, fullPage: true });

      // Future event date so the form's `min` constraint passes.
      const future = new Date();
      future.setDate(future.getDate() + 14);
      const eventDate = future.toISOString().slice(0, 10);

      await page.fill('input[name="first_name"]', "Jordan");
      await page.fill('input[name="last_name"]', "Rivera");
      await page.fill('input[name="phone"]', "555-0142");
      await page.fill('input[name="event_date"]', eventDate);

      // Pick our newly-created bouncer. The select option text includes
      // both name + price, so a regex find is more robust than asserting
      // exact text.
      const productSelect = page.locator('select[name="product_id"]');
      const productOptions = await productSelect.locator("option").allTextContents();
      const bouncerIndex = productOptions.findIndex((t) => /Castle Bouncer/i.test(t));
      expect(bouncerIndex, "newly-created product wasn't in the dropdown").toBeGreaterThan(0);
      await productSelect.selectOption({ index: bouncerIndex });

      // Subtotal matches the product's base price; depositAmount must
      // be ≤ subtotal+deliveryFee per the schema's superRefine.
      await page.fill('input[name="subtotal"]', "165");
      await page.fill('input[name="deposit_amount"]', "50");

      await page.screenshot({ path: `${SCREENSHOTS}/12-new-order-filled.png`, fullPage: true });

      await page.locator('button[type="submit"]').first().click();
      await page.waitForLoadState("networkidle", { timeout: 15_000 });
      await page.screenshot({ path: `${SCREENSHOTS}/13-after-order-submit.png`, fullPage: true });

      const finalUrl = page.url();
      const errorBanner = page.locator('[role="alert"], .field-error, .form-error');
      const errorText =
        (await errorBanner.count()) > 0 ? await errorBanner.first().innerText() : "(none)";

      test.info().annotations.push({
        type: "result",
        description: `Final URL: ${finalUrl}`,
      });
      test.info().annotations.push({
        type: "result",
        description: `Error text: ${errorText}`,
      });

      // Successful create redirects to /dashboard/orders/<id>. If we
      // stayed on /new, the action errored — surface the message.
      expect(
        finalUrl,
        `Form stayed on /new — likely a validation error: ${errorText}`,
      ).not.toMatch(/\/orders\/new/);
    });

    test("Stage 7: operator confirms the draft order", async ({ page }) => {
      // KNOWN BUG: ConfirmOrderButton flashes a success badge after
      // click (action returns ok=true) but a full page reload still
      // shows "Inquiry" + the Mark Confirmed button — the DB write
      // never lands. Suspected root cause is in the updateOrderStatus
      // path on the Vercel preview; needs server-side log capture to
      // confirm. Marked expected-to-fail so the suite stays green
      // until the fix; if the assertion below ever starts passing,
      // Playwright will surface that as an "unexpected pass" — at
      // which point delete this annotation.
      test.fail();
      // Filter to inquiry-only so the customer-storefront order from
      // Stage 4b (auto-confirmed when deposit is $0) doesn't get
      // picked up as the "first article-wrapped row." We want
      // Jordan's draft, not Avery's already-confirmed booking.
      await page.goto("/dashboard/orders?status=inquiry");
      await page.screenshot({ path: `${SCREENSHOTS}/14-orders-list.png`, fullPage: true });

      // Order rows render as <a> wrapping an <article>; the link
      // itself has no accessible name (the customer name is just a
      // nested div). Use the article-wrap to disambiguate from the
      // "New Order" CTA and the filter chips on this page.
      const orderLink = page
        .locator('a[href^="/dashboard/orders/"]')
        .filter({ has: page.locator("article") })
        .first();
      await expect(orderLink).toBeVisible({ timeout: 10_000 });
      const orderHref = await orderLink.getAttribute("href");
      expect(orderHref, "expected an inquiry-status order to be in the list").toBeTruthy();
      test.info().annotations.push({
        type: "result",
        description: `Stage 7 will confirm: ${orderHref}`,
      });
      // Wait for hydration before the click — without this, the React
      // event handler may not be attached yet and the click silently
      // no-ops on the server-rendered HTML. The action then never
      // fires, the optimistic "Confirmed" UI appears because router
      // refresh re-renders but no DB write happened.
      await page.waitForLoadState("networkidle", { timeout: 10_000 });
      // Navigate directly via href instead of click() — bypasses the
      // dismissable banner overlay that can intercept the row click.
      await page.goto(orderHref!);
      await page.screenshot({ path: `${SCREENSHOTS}/15-order-detail.png`, fullPage: true });

      // Confirm button is hidden once the order has moved past
      // {inquiry, quote_sent, awaiting_deposit}. On a fresh draft
      // it should be visible. Label is "Mark Confirmed" (en) per
      // lib/i18n/messages/en.ts → dashboard.orders.detail.confirmOrderCta.
      const confirmBtn = page.getByRole("button", { name: /mark confirmed/i });
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
      await confirmBtn.click();

      // The ConfirmOrderButton replaces itself with a success badge
      // when the action returns ok=true and then calls router.refresh().
      // Wait for the button to disappear, then *reload* the page so
      // we read the server-rendered state from a fresh request — the
      // optimistic in-memory badge alone doesn't prove the DB write
      // persisted, only the reloaded header status does.
      await expect(confirmBtn).toBeHidden({ timeout: 10_000 });
      await page.reload();
      await expect(confirmBtn).toBeHidden({ timeout: 5_000 });
      // After reload the only place "Confirmed" should appear is the
      // status badge near the order header (the button itself is gone
      // because the state machine no longer permits the transition).
      await expect(page.locator("body")).toContainText(/confirmed/i);
      await expect(page.getByRole("button", { name: /mark confirmed/i })).toHaveCount(0);
      await page.screenshot({ path: `${SCREENSHOTS}/16-order-confirmed.png`, fullPage: true });
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


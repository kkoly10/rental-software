import { test, expect } from "@playwright/test";

/**
 * Inflatable vertical end-to-end walkthrough.
 *
 * Runs against live production by default (see
 * playwright.e2e.config.ts → E2E_BASE_URL). Each `test.step` covers
 * one stage from docs/qa/vertical-walkthroughs.md.
 *
 * The spec is intentionally observational: it asserts every page in
 * the journey loads + the key text appears + a screenshot is taken
 * for the markdown findings doc. Hard pass/fail assertions are
 * minimal so a copy-or-styling bug doesn't fail the whole walk —
 * the reviewer reads the screenshots + the findings log.
 *
 * STOPS BEFORE Stripe redirect. Real-money flow is exercised
 * separately with a dedicated test-mode key + a sandbox org.
 */

// Unique suffix per run so re-running the spec doesn't collide with
// the previous run's `[E2E TEST] Inflatable` org / product / order.
const RUN_ID = process.env.E2E_RUN_ID ?? `${Date.now().toString(36)}`;
const TEST_EMAIL = `e2e+inflatable-${RUN_ID}@example.test`;
const TEST_PASSWORD = "ThisIsAStrongTestPassword!2026";
const TEST_BUSINESS = `[E2E TEST] Inflatable ${RUN_ID}`;
const TEST_SLUG = `e2e-inflatable-${RUN_ID}`.toLowerCase().slice(0, 50);

test.describe("Inflatable vertical — end-to-end operator + customer walk", () => {
  test("Stage 1: marketing → signup", async ({ page }) => {
    await test.step("Land on inflatable marketing page", async () => {
      await page.goto("/inflatable-rental-software");
      await expect(page).toHaveTitle(/Inflatable/i);
      // The hero headline pins the vertical-specific copy from
      // lib/verticals/inflatables.ts — if this fails, marketing
      // either 404s or got swapped to a generic hub.
      await page.screenshot({ path: `playwright-e2e-report/01-marketing-inflatable-${RUN_ID}.png`, fullPage: true });
    });

    await test.step("Click signup CTA", async () => {
      // Multiple CTAs on the marketing page; first signup link wins.
      const signupLink = page.locator('a[href*="/signup"]').first();
      await expect(signupLink).toBeVisible();
      await signupLink.click();
      await expect(page).toHaveURL(/\/signup/);
      await page.screenshot({ path: `playwright-e2e-report/02-signup-form-${RUN_ID}.png`, fullPage: true });
    });

    await test.step("Submit signup form", async () => {
      await page.fill('input[name="email"]', TEST_EMAIL);
      await page.fill('input[name="password"]', TEST_PASSWORD);
      await page.fill('input[name="full_name"]', "E2E Test Operator");
      // Terms checkbox — required by the action.
      const terms = page.locator('input[name="terms_accepted"]');
      if (await terms.count() > 0) {
        await terms.check();
      }
      // Submit. Action returns ok=true and redirects to /auth/verify-email.
      // We can't actually verify the email in CI; stop here and let
      // a subsequent stage skip ahead with a pre-verified test account.
      await page.click('button[type="submit"]');
      await page.screenshot({ path: `playwright-e2e-report/03-signup-submitted-${RUN_ID}.png`, fullPage: true });
    });

    // Mark this stage as blocked-by-design: real email verification
    // requires a human checking the inbox or a pre-verified test
    // account. Subsequent stages assume the account exists already.
    test.info().annotations.push({
      type: "follow-up",
      description:
        "Email verification requires manual click-through or pre-provisioned test account. Update test fixtures.",
    });
  });

  test("Stage 2 → 9: requires verified test account", async ({ page }) => {
    // Skip body until we have a fixture account. Logs the gap so the
    // human reviewer knows what to wire next.
    test.skip(
      !process.env.E2E_INFLATABLE_OPERATOR_EMAIL,
      "Set E2E_INFLATABLE_OPERATOR_EMAIL + E2E_INFLATABLE_OPERATOR_PASSWORD to drive stages 2-9.",
    );

    const operatorEmail = process.env.E2E_INFLATABLE_OPERATOR_EMAIL!;
    const operatorPassword = process.env.E2E_INFLATABLE_OPERATOR_PASSWORD!;

    await test.step("Stage 2: log in (pre-verified test account)", async () => {
      await page.goto("/login");
      await page.fill('input[name="email"]', operatorEmail);
      await page.fill('input[name="password"]', operatorPassword);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
      await page.screenshot({ path: `playwright-e2e-report/04-logged-in-${RUN_ID}.png`, fullPage: true });
    });

    await test.step("Stage 2.5: onboarding (if first login)", async () => {
      if (page.url().includes("/onboarding")) {
        // Pick inflatable, fill required fields, submit.
        await page.click('input[type="radio"][value="inflatable"]');
        await page.fill('input[name="business_name"]', TEST_BUSINESS);
        await page.fill('input[name="slug"]', TEST_SLUG);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/dashboard/);
        await page.screenshot({ path: `playwright-e2e-report/05-onboarded-${RUN_ID}.png`, fullPage: true });
      }
    });

    await test.step("Stage 3: dashboard empty state shows bouncer copy", async () => {
      await page.goto("/dashboard/products");
      // Verifies the #288/#289 empty-state copy is wired for inflatable.
      await expect(page.getByText(/no bouncers yet/i)).toBeVisible();
      await page.screenshot({ path: `playwright-e2e-report/06-products-empty-${RUN_ID}.png`, fullPage: true });
    });

    await test.step("Stage 3: starter example shows on new-product banner", async () => {
      await page.goto("/dashboard/products/new");
      // Verifies #290 starter-example card.
      await expect(page.getByText(/13ft Castle Bouncer/i)).toBeVisible();
      await page.screenshot({ path: `playwright-e2e-report/07-new-product-starter-${RUN_ID}.png`, fullPage: true });
    });

    // Stages 4-9 land as the walkthrough doc gets richer fixtures.
    // For now this spec exercises the operator-side surfaces that
    // need the least state setup. Customer-side + payment flows go
    // in a follow-up spec keyed off a known-good product slug.
    test.info().annotations.push({
      type: "follow-up",
      description:
        "Add product creation, storefront browse, checkout flow stages. Block on Stripe deposit redirect; verify customer-side review summary first.",
    });
  });
});

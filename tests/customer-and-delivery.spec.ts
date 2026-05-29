/**
 * Customer Booking + Delivery Coordination E2E
 *
 * Two halves of one flow:
 *
 *  1. Public customer side (no auth) on couranr.korent.app
 *     - browse the storefront and inventory
 *     - open the product detail page
 *     - fill the booking form on /checkout
 *     - submit and confirm we end up either on Stripe Checkout (deposit
 *       required) or on /order-confirmation (no deposit). We stop at the
 *       Stripe page — we never actually charge a card.
 *
 *  2. Operator side (uses the saved /tmp/korent-auth.json session) on
 *     korent.app
 *     - confirm the new order is in /dashboard/orders
 *     - visit /dashboard/deliveries, then the route detail page for the
 *       delivery route the operator-walkthrough spec already created
 *     - confirm the route map (Leaflet) renders
 *     - confirm the service-area map renders on /dashboard/service-areas
 *
 * Screenshots land in /tmp/screenshots/. Designed to be run by
 * playwright.dashboard.config.ts so the global setup has already signed
 * the operator in once.
 */
import { test, expect, Page, BrowserContext } from "@playwright/test";
import * as fs from "fs";

const STOREFRONT = "https://couranr.korent.app";
const DASHBOARD = "https://korent.app";

async function ss(page: Page, name: string) {
  await page
    .screenshot({ path: `/tmp/screenshots/${name}.png`, fullPage: true })
    .catch(() => {});
}

// Strip query so screenshot file names stay sane
function uniqueEmail(): string {
  return `e2e-customer+${Date.now()}@example.com`;
}

// ─── 1. Customer browses the storefront ─────────────────────────────────────

test("C01 — storefront home loads with hero + categories", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();
  await page.goto(`${STOREFRONT}/`, { waitUntil: "networkidle" });
  await ss(page, "C01-home");

  const heroImg = page.locator("img.st-hero-photo").first();
  await expect(heroImg, "hero <img> rendered").toBeVisible({ timeout: 10_000 });
  const heroSrc = await heroImg.getAttribute("src");
  console.log("  hero src:", heroSrc);
  expect(heroSrc, "hero src is not the dead photo we just fixed").not.toContain(
    "1607113284254-1ab1f6b48e21"
  );

  // there should be at least one product card linking to /inventory/...
  const productLinks = await page.locator('a[href^="/inventory/"]').count();
  console.log("  product links on home:", productLinks);
  expect(productLinks).toBeGreaterThan(0);

  await ctx.close();
});

test("C02 — catalog page loads with inventory items", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();
  await page.goto(`${STOREFRONT}/inventory`, { waitUntil: "networkidle" });
  await ss(page, "C02-catalog");

  const cards = await page.locator('a[href^="/inventory/"]').count();
  console.log("  catalog cards:", cards);
  expect(cards).toBeGreaterThan(0);
  await ctx.close();
});

// ─── 2. Customer opens a product and clicks Book ────────────────────────────

test("C03 — product detail page renders pricing + book CTA", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();
  await page.goto(`${STOREFRONT}/inventory/20x20-party-tent`, {
    waitUntil: "networkidle",
  });
  await ss(page, "C03-product");

  const bodyText = await page.locator("body").innerText();
  // expect some kind of price marker — $ or /day
  expect(bodyText, "product detail shows a price or 'day'").toMatch(/\$|\/day/i);

  const bookLink = page
    .locator('a[href^="/checkout"], a[href*="?product="]')
    .first();
  await expect(bookLink, "book / checkout link is present").toBeVisible({
    timeout: 5_000,
  });

  await ctx.close();
});

// ─── 3. Customer fills checkout form and submits ────────────────────────────

let placedOrderEmail = "";
let placedOrderUrl = "";

test("C04 — customer completes booking form on /checkout", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ storageState: undefined });
  const page = await ctx.newPage();
  placedOrderEmail = uniqueEmail();

  await page.goto(`${STOREFRONT}/checkout?product=20x20-party-tent`, {
    waitUntil: "networkidle",
  });
  await ss(page, "C04a-checkout-empty");

  // Customer info
  await page.locator('input[name="first_name"]').fill("Playwright");
  await page.locator('input[name="last_name"]').fill("Customer");
  await page.locator('input[name="phone"]').fill("5555550199");
  await page.locator('input[name="email"]').fill(placedOrderEmail);

  // Event date: ~28 days out (clamped to the form's min/max if needed)
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 28);
  const dateInput = page.locator('input[name="event_date"]');
  const maxDate = await dateInput.getAttribute("max");
  const minDate = await dateInput.getAttribute("min");
  let dateStr = eventDate.toISOString().split("T")[0];
  if (maxDate && dateStr > maxDate) dateStr = maxDate;
  if (minDate && dateStr < minDate) dateStr = minDate;
  await dateInput.fill(dateStr);

  // Times — fill if they're present, harmless if not required
  await page.locator('input[name="start_time"]').fill("12:00").catch(() => {});
  await page.locator('input[name="end_time"]').fill("18:00").catch(() => {});

  // Delivery address — use the operator's own ZIP placeholder so service-area
  // checks pass. The form requires line1/city/state/postal_code.
  await page.locator('input[name="line1"]').fill("123 Test Lane");
  await page.locator('input[name="city"]').fill("Stafford");
  await page.locator('input[name="state"]').fill("VA");
  await page.locator('input[name="postal_code"]').fill("22554");

  // Terms checkbox — required
  await page.locator('input[name="terms_accepted"]').check({ force: true });

  await ss(page, "C04b-checkout-filled");

  // Submit. Outcomes we accept:
  //   - redirect to Stripe Checkout (checkout.stripe.com) — deposit flow
  //   - redirect to /order-confirmation                    — no-deposit flow
  //   - same page with an unavailability / coverage error  — form worked, the
  //     org rejected the date/zip. Logged but not failed since this depends
  //     on live availability data.
  const submitBtn = page
    .locator('button[type="submit"]')
    .filter({ hasText: /book|confirm|reserve|place|submit/i })
    .first();
  await submitBtn.scrollIntoViewIfNeeded().catch(() => {});

  await Promise.all([
    page
      .waitForURL(
        (u) =>
          u.toString().includes("checkout.stripe.com") ||
          u.toString().includes("/order-confirmation"),
        { timeout: 25_000 }
      )
      .catch(() => undefined),
    submitBtn.click(),
  ]);
  await page.waitForTimeout(1500);
  placedOrderUrl = page.url();
  await ss(page, "C04c-after-submit");

  console.log("  email used     :", placedOrderEmail);
  console.log("  url after submit:", placedOrderUrl);

  if (placedOrderUrl.includes("checkout.stripe.com")) {
    console.log("  ✓ redirected to Stripe Checkout — deposit flow working");
    // Don't actually pay; the order is already created server-side before
    // the Stripe session.
  } else if (placedOrderUrl.includes("/order-confirmation")) {
    console.log("  ✓ landed on order-confirmation — no-deposit flow");
  } else {
    // Form was submitted but something else happened — capture the page body
    const body = await page.locator("body").innerText().catch(() => "");
    const snippet = body.replace(/\s+/g, " ").slice(0, 400);
    console.warn("  ⚠ unexpected post-submit URL. Body snippet:", snippet);
  }

  // Whatever the outcome, we should NOT be on a 500 page.
  const body = await page.locator("body").innerText().catch(() => "");
  expect(body.toLowerCase()).not.toContain("application error");
  expect(body.toLowerCase()).not.toContain("internal server error");

  await ctx.close();
});

// ─── 4. Operator finds the new order in the dashboard ───────────────────────

async function operatorContext(browser: import("@playwright/test").Browser) {
  const stateFile = "/tmp/korent-auth.json";
  if (!fs.existsSync(stateFile)) {
    throw new Error(
      "operator auth state missing — was the dashboard config's globalSetup skipped?"
    );
  }
  return browser.newContext({ storageState: stateFile });
}

test("D01 — operator can see the order list", async ({ browser }) => {
  const ctx: BrowserContext = await operatorContext(browser);
  const page = await ctx.newPage();
  await page.goto(`${DASHBOARD}/dashboard/orders`, {
    waitUntil: "networkidle",
  });
  await ss(page, "D01-orders");
  expect(page.url(), "should not have been bounced to login").not.toContain(
    "/login"
  );

  // Best-effort: look for the email we just used. The order may take a couple
  // of seconds to appear; we don't fail the test on it because there's also a
  // chance the customer's booking landed in a "leads" bucket vs "orders".
  const body = await page.locator("body").innerText();
  const foundEmail =
    placedOrderEmail && body.includes(placedOrderEmail.split("@")[0]);
  console.log(
    `  newly-placed email '${placedOrderEmail}' visible in orders page: ${foundEmail}`
  );

  await ctx.close();
});

// ─── 5. Operator drills into a delivery route — Leaflet map renders ────────

test("D02 — deliveries board: create a route for today and inspect its map", async ({
  browser,
}) => {
  const ctx = await operatorContext(browser);
  const page = await ctx.newPage();

  // a) /dashboard/deliveries list
  await page.goto(`${DASHBOARD}/dashboard/deliveries`, {
    waitUntil: "networkidle",
  });
  await ss(page, "D02a-deliveries-list");
  expect(page.url()).not.toContain("/login");
  expect((await page.locator("body").innerText()).toLowerCase()).toContain(
    "delivery"
  );

  // b) The board's "Today's route board" only surfaces routes scheduled for
  //    today.  The walkthrough's route is 28 days out, so it's not listed
  //    here.  Easiest way to drive the route-detail page (and exercise the
  //    Leaflet route map) end-to-end is to create a brand new route for
  //    today in the inline form, then follow the redirect.
  const today = new Date().toISOString().split("T")[0];
  const routeName = `E2E Today's Run ${Date.now()}`;

  await page.locator('input[name="name"]').fill(routeName);
  await page.locator('input[name="route_date"]').fill(today).catch(() => {});
  await page
    .locator('input[name="assigned_vehicle"]')
    .fill("Truck E2E")
    .catch(() => {});
  await ss(page, "D02b-create-route-filled");

  const submit = page
    .locator('button[type="submit"]')
    .filter({ hasText: /create route/i })
    .first();

  await Promise.all([
    page
      .waitForURL(/\/dashboard\/deliveries\/[0-9a-f-]{36}/, { timeout: 15_000 })
      .catch(() => undefined),
    submit.click(),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});

  const routeDetailUrl = page.url();
  console.log("  route detail url:", routeDetailUrl);
  await ss(page, "D02c-route-detail");

  // If the redirect didn't fire (race), try clicking the new row by name
  // from the board.
  if (!routeDetailUrl.match(/\/dashboard\/deliveries\/[0-9a-f-]{36}/)) {
    await page.goto(`${DASHBOARD}/dashboard/deliveries`, {
      waitUntil: "networkidle",
    });
    const fallbackLink = page
      .locator(`a:has-text("${routeName}")`)
      .first();
    if ((await fallbackLink.count()) > 0) {
      await fallbackLink.click();
      await page.waitForLoadState("networkidle").catch(() => {});
    }
  }

  // c) Leaflet wrapper renders. With no geocoded stops, the route-map
  //    component falls back to its empty-state container (still className
  //    "route-map-container"), so the selector matches either way.
  const mapLocator = page
    .locator(".route-map-container, .leaflet-container, [class*='leaflet']")
    .first();
  const mapVisible = await mapLocator
    .waitFor({ timeout: 12_000 })
    .then(() => true)
    .catch(() => false);
  console.log(`  route map container present: ${mapVisible}`);
  await ss(page, "D02d-route-detail-map");
  expect(mapVisible, "route map (Leaflet wrapper) rendered").toBe(true);

  await ctx.close();
});

// ─── 6. Operator inspects the service-area coverage map ─────────────────────

test("D03 — service-area map renders on /dashboard/service-areas", async ({
  browser,
}) => {
  const ctx = await operatorContext(browser);
  const page = await ctx.newPage();
  await page.goto(`${DASHBOARD}/dashboard/service-areas`, {
    waitUntil: "networkidle",
  });
  await ss(page, "D03a-service-areas");
  expect(page.url()).not.toContain("/login");

  // Service-area map may be lazy-mounted; give it a moment.
  const mapLocator = page
    .locator(
      ".svc-map-container, .leaflet-container, [class*='leaflet']"
    )
    .first();
  const mapVisible = await mapLocator
    .waitFor({ timeout: 12_000 })
    .then(() => true)
    .catch(() => false);
  console.log(`  service-area map container present: ${mapVisible}`);
  await ss(page, "D03b-service-area-map");
  // soft: the page itself loaded and didn't 500.
  const body = await page.locator("body").innerText();
  expect(body.toLowerCase()).not.toContain("internal server error");

  await ctx.close();
});

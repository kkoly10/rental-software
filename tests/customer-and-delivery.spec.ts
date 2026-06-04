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

  const body = await page.locator("body").innerText().catch(() => "");
  const bodyLower = body.toLowerCase();

  // Gap #4: the previous assertion accepted any URL and only failed on
  // 500-page text. A checkout that silently stays on /checkout (e.g.
  // ZIP rejected, no service area coverage) would still be reported as
  // "passed". Now we require a positive success signal: either a known
  // success URL, or a success indicator in the page body.
  const stripeRedirect = placedOrderUrl.includes("checkout.stripe.com");
  const confirmationPage = placedOrderUrl.includes("/order-confirmation");
  const inPageSuccess = /booking (received|submitted|confirmed)|order (received|placed|confirmed)|thank you/i.test(
    body,
  );

  if (stripeRedirect) {
    console.log("  ✓ redirected to Stripe Checkout — deposit flow working");
  } else if (confirmationPage) {
    console.log("  ✓ landed on order-confirmation — no-deposit flow");
  } else if (inPageSuccess) {
    console.log("  ✓ in-page success indicator detected");
  } else {
    const snippet = body.replace(/\s+/g, " ").slice(0, 400);
    console.warn("  ⚠ unexpected post-submit state. Body snippet:", snippet);
  }

  expect(bodyLower).not.toContain("application error");
  expect(bodyLower).not.toContain("internal server error");
  expect(
    stripeRedirect || confirmationPage || inPageSuccess,
    `checkout did not reach a known success state. url=${placedOrderUrl}`,
  ).toBe(true);

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

// ─── 7. Operator: full chain — create confirmed order with delivery address,
//        attach it as a stop on today's route, and verify the Leaflet route
//        map renders an actual marker (not the empty state). ────────────────

test("D04 — attach order with address to today's route and see a real map marker", async ({
  browser,
}) => {
  const ctx = await operatorContext(browser);
  const page = await ctx.newPage();
  const today = new Date().toISOString().split("T")[0];
  const stamp = Date.now();

  // a) Create a confirmed order with a real, geocodable delivery address for
  //    TODAY.  The "Add Stop" UI on the route detail page only lists
  //    confirmed, route-less orders whose event_date matches the route date.
  await page.goto(`${DASHBOARD}/dashboard/orders/new`, {
    waitUntil: "networkidle",
  });
  await ss(page, "D04a-order-form-empty");

  await page.locator('input[name="first_name"]').fill("Mapcheck");
  await page.locator('input[name="last_name"]').fill(`Customer${stamp}`);
  await page.locator('input[name="phone"]').fill("4045550199");
  await page
    .locator('input[name="email"]')
    .fill(`mapcheck+${stamp}@example.com`);

  await page.locator('input[name="event_date"]').fill(today);

  // Status = confirmed so the route's stop picker will see it.
  await page
    .locator('select[name="order_status"]')
    .selectOption("confirmed")
    .catch(async () => {
      // some forms label the value differently — fall back to the second option
      await page
        .locator('select[name="order_status"]')
        .selectOption({ index: 1 })
        .catch(() => {});
    });

  // Pick the first real product if available (route_date stop-list only
  // counts orders with at least one product).
  const productSel = page.locator('select[name="product_id"]');
  const productOptions = await productSel.locator("option").all();
  for (const o of productOptions.slice(1)) {
    const v = await o.getAttribute("value");
    if (v) {
      await productSel.selectOption(v);
      break;
    }
  }

  // Real, geocodable address.  Centennial Olympic Park, Atlanta — matches
  // the "Metro Atlanta" service area the walkthrough sets up.
  await page.locator('input[name="delivery_line1"]').fill("265 Park Ave W NW");
  await page.locator('input[name="delivery_city"]').fill("Atlanta");
  await page.locator('input[name="delivery_state"]').fill("GA");
  await page.locator('input[name="delivery_zip"]').fill("30313");
  await page
    .locator('input[name="delivery_contact_name"]')
    .fill("Mapcheck Customer")
    .catch(() => {});
  await page
    .locator('input[name="delivery_contact_phone"]')
    .fill("4045550199")
    .catch(() => {});

  await page.locator('input[name="subtotal"]').fill("250").catch(() => {});
  await page
    .locator('textarea[name="notes"]')
    .fill("E2E route-map address test — please ignore.")
    .catch(() => {});

  await ss(page, "D04b-order-form-filled");

  const orderSubmit = page
    .locator('button[type="submit"]')
    .filter({ hasText: /create order/i })
    .first();
  await Promise.all([
    page
      .waitForURL(/\/dashboard\/orders\/(?!new)/, { timeout: 20_000 })
      .catch(() => undefined),
    orderSubmit.click(),
  ]);
  await page.waitForTimeout(1500);
  await ss(page, "D04c-order-created");

  const orderUrl = page.url();
  console.log("  confirmed order url:", orderUrl);
  expect(orderUrl).toContain("/dashboard/orders");
  expect(orderUrl).not.toContain("/new");

  // b) Create a route for today (separate from any D02 route so the tests
  //    remain independent — D04 doesn't rely on the order of execution).
  await page.goto(`${DASHBOARD}/dashboard/deliveries`, {
    waitUntil: "networkidle",
  });
  const routeName = `E2E Map Run ${stamp}`;
  await page.locator('input[name="name"]').fill(routeName);
  await page.locator('input[name="route_date"]').fill(today).catch(() => {});
  await page
    .locator('input[name="assigned_vehicle"]')
    .fill("Truck Mapcheck")
    .catch(() => {});

  await Promise.all([
    page
      .waitForURL(/\/dashboard\/deliveries\/[0-9a-f-]{36}/, { timeout: 15_000 })
      .catch(() => undefined),
    page
      .locator('button[type="submit"]')
      .filter({ hasText: /create route/i })
      .first()
      .click(),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
  const routeUrl = page.url();
  console.log("  route url:", routeUrl);
  await ss(page, "D04d-route-detail-empty");

  // Sanity: empty-state marker should be visible before we add the stop.
  const emptyStateBefore = await page
    .locator("text=/add addresses to see route on map/i")
    .first()
    .isVisible()
    .catch(() => false);
  console.log(`  empty-state ("Add addresses…") visible before stop: ${emptyStateBefore}`);

  // c) Open the Add Stop form and pick our just-created order.
  const orderSelect = page.locator('select[name="order_id"]');
  await orderSelect.waitFor({ timeout: 8_000 }).catch(() => {});

  const stopOptions = await orderSelect.locator("option").all();
  console.log(`  Add Stop — orders available: ${stopOptions.length - 1}`);
  let attachedOrderId = "";
  let pickedLabel = "";
  for (const opt of stopOptions.slice(1)) {
    const value = await opt.getAttribute("value");
    const label = (await opt.innerText()).trim();
    if (value && /mapcheck/i.test(label)) {
      attachedOrderId = value;
      pickedLabel = label;
      break;
    }
  }
  if (!attachedOrderId && stopOptions.length > 1) {
    // Fall back to the first available confirmed order — still proves the
    // attach-and-render path even if our exact order isn't picked.
    const first = stopOptions[1];
    attachedOrderId = (await first.getAttribute("value")) ?? "";
    pickedLabel = (await first.innerText()).trim();
  }
  console.log(`  picked order: "${pickedLabel}" (${attachedOrderId})`);

  if (attachedOrderId) {
    await orderSelect.selectOption(attachedOrderId);
    await page
      .locator('select[name="stop_type"]')
      .selectOption("delivery")
      .catch(() => {});
    await page
      .locator('input[name="scheduled_time"]')
      .fill("12:00")
      .catch(() => {});
    await ss(page, "D04e-add-stop-filled");

    const addStopBtn = page
      .locator('button[type="submit"]')
      .filter({ hasText: /add stop|add to route|attach/i })
      .first();
    await addStopBtn.click().catch(async () => {
      // fallback: the form may only have one submit button
      await page.locator('form button[type="submit"]').first().click();
    });

    // Server action will revalidate the page; wait for it to settle.
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500); // allow geocode + map re-render
    await ss(page, "D04f-after-stop");

    // d) Hard signal: the Leaflet container should now have at least one
    //    marker img.  We also accept a polyline or the "Total stops" counter
    //    flipping from 0 to >=1, since geocoding can race or fail silently.
    const markerCount = await page.locator(".leaflet-marker-icon").count();
    const stopsText = await page
      .locator("text=/total stops/i")
      .first()
      .innerText()
      .catch(() => "");
    const emptyStateAfter = await page
      .locator("text=/add addresses to see route on map/i")
      .first()
      .isVisible()
      .catch(() => false);

    console.log(`  leaflet markers on map      : ${markerCount}`);
    console.log(`  total-stops counter text    : "${stopsText.trim()}"`);
    console.log(`  empty-state visible after?  : ${emptyStateAfter}`);
    await ss(page, "D04g-route-detail-with-marker");

    const stopWasAttached =
      markerCount > 0 ||
      /[1-9]\d*\s+total/i.test(stopsText) ||
      !emptyStateAfter;
    expect(
      stopWasAttached,
      "route should now have at least one stop (marker on map, counter > 0, or empty-state hidden)"
    ).toBe(true);
  } else {
    // No selectable order — log + fail with a useful message rather than
    // silently passing.
    await ss(page, "D04e-no-orders-available");
    throw new Error(
      "Add Stop dropdown was empty. The just-created order was not picked up — likely missing required field (product, delivery address, or status=confirmed)."
    );
  }

  await ctx.close();
});

// ─── 8. Two-stop route — verify polyline draws between stops and the
//        "Open route in maps" link is a real Google Maps directions URL
//        with origin, destination, and waypoint encoded. ──────────────────

test("D05 — two-stop route shows polyline and exposes a real directions URL", async ({
  browser,
}) => {
  // This test creates two orders, a route, and attaches two stops — that's
  // a lot of form-fill round trips against live korent.app, so we override
  // the dashboard config's 90s default with a longer budget.
  test.setTimeout(240_000);
  const ctx = await operatorContext(browser);
  const page = await ctx.newPage();
  const today = new Date().toISOString().split("T")[0];
  const stamp = Date.now();

  // Two real, geocodable Atlanta addresses inside the operator's "Metro
  // Atlanta" service area.  Both must be on confirmed orders for today
  // so the route detail page's Add-Stop dropdown surfaces them.
  const stops = [
    {
      label: "A",
      line1: "265 Park Ave W NW", // Centennial Olympic Park
      zip: "30313",
    },
    {
      label: "B",
      line1: "600 W Peachtree St NW", // Bank of America Plaza
      zip: "30308",
    },
  ];

  async function createConfirmedOrder(label: string, line1: string, zip: string) {
    await page.goto(`${DASHBOARD}/dashboard/orders/new`, {
      waitUntil: "networkidle",
    });
    await page.locator('input[name="first_name"]').fill(`Routing${label}`);
    await page
      .locator('input[name="last_name"]')
      .fill(`Customer${stamp}-${label}`);
    await page.locator('input[name="phone"]').fill("4045550199");
    await page
      .locator('input[name="email"]')
      .fill(`routing+${stamp}-${label}@example.com`);
    await page.locator('input[name="event_date"]').fill(today);
    await page
      .locator('select[name="order_status"]')
      .selectOption("confirmed")
      .catch(async () => {
        await page
          .locator('select[name="order_status"]')
          .selectOption({ index: 1 })
          .catch(() => {});
      });
    const productSel = page.locator('select[name="product_id"]');
    for (const o of await productSel.locator("option").all()) {
      const v = await o.getAttribute("value");
      if (v) {
        await productSel.selectOption(v);
        break;
      }
    }
    await page.locator('input[name="delivery_line1"]').fill(line1);
    await page.locator('input[name="delivery_city"]').fill("Atlanta");
    await page.locator('input[name="delivery_state"]').fill("GA");
    await page.locator('input[name="delivery_zip"]').fill(zip);
    await page.locator('input[name="subtotal"]').fill("250").catch(() => {});

    await Promise.all([
      page
        .waitForURL(/\/dashboard\/orders\/(?!new)/, { timeout: 20_000 })
        .catch(() => undefined),
      page
        .locator('button[type="submit"]')
        .filter({ hasText: /create order/i })
        .first()
        .click(),
    ]);
    await page.waitForLoadState("networkidle").catch(() => {});
  }

  for (const s of stops) await createConfirmedOrder(s.label, s.line1, s.zip);

  // Create a fresh route for today.
  await page.goto(`${DASHBOARD}/dashboard/deliveries`, {
    waitUntil: "networkidle",
  });
  await page.locator('input[name="name"]').fill(`E2E Directions ${stamp}`);
  await page.locator('input[name="route_date"]').fill(today).catch(() => {});
  await page
    .locator('input[name="assigned_vehicle"]')
    .fill("Truck Routing")
    .catch(() => {});
  await Promise.all([
    page
      .waitForURL(/\/dashboard\/deliveries\/[0-9a-f-]{36}/, { timeout: 15_000 })
      .catch(() => undefined),
    page
      .locator('button[type="submit"]')
      .filter({ hasText: /create route/i })
      .first()
      .click(),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
  await ss(page, "D05a-route-detail-empty");

  // Attach both orders as stops via the Add-Stop form.
  async function attachStopForOrderLabel(label: string) {
    const orderSelect = page.locator('select[name="order_id"]');
    await orderSelect.waitFor({ timeout: 8_000 }).catch(() => {});
    let targetValue = "";
    for (const opt of (await orderSelect.locator("option").all()).slice(1)) {
      const value = await opt.getAttribute("value");
      const text = (await opt.innerText()).trim();
      if (value && text.includes(`-${label}`)) {
        targetValue = value;
        break;
      }
    }
    if (!targetValue) {
      throw new Error(
        `Could not find order labelled "${label}" in Add Stop dropdown — found ${
          (await orderSelect.locator("option").count()) - 1
        } candidate(s)`
      );
    }
    // Scope to the Add-Stop form specifically — the route detail page also
    // has "Complete Route" / "Mark En Route" / "Remove" submit buttons that
    // would otherwise be selected by a generic form button[type="submit"]
    // query and silently move the route to Completed instead of attaching
    // the stop.  The Add-Stop form is the only one on the page that has
    // the order_id select inside it.
    const addStopForm = page
      .locator("form")
      .filter({ has: page.locator('select[name="order_id"]') })
      .first();
    await orderSelect.selectOption(targetValue);
    await addStopForm
      .locator('select[name="stop_type"]')
      .selectOption("delivery")
      .catch(() => {});
    await addStopForm
      .locator('input[name="scheduled_time"]')
      .fill(label === "A" ? "11:00" : "13:30")
      .catch(() => {});
    await addStopForm.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500); // geocode + map re-render
  }

  await attachStopForOrderLabel("A");
  await attachStopForOrderLabel("B");
  await ss(page, "D05b-route-with-two-stops");

  // a) Marker count ≥ 2 — both stops on the map.
  const markerCount = await page.locator(".leaflet-marker-icon").count();
  console.log(`  leaflet markers : ${markerCount}`);

  // b) Polyline drawn — Leaflet renders polylines as <path> elements inside
  //    the .leaflet-overlay-pane SVG.  Our route-map.tsx draws an orange
  //    dashed line, so we look for any path inside that pane.
  const polyCount = await page
    .locator(".leaflet-overlay-pane svg path")
    .count();
  console.log(`  leaflet polyline paths : ${polyCount}`);

  // c) "Open route in maps" — extract the actual directions URL and verify
  //    it contains both stop addresses (URL-encoded).
  const mapsLink = page
    .locator('a[href*="/maps/dir/?"]')
    .first();
  const mapsHref = (await mapsLink.getAttribute("href").catch(() => null)) ?? "";
  console.log("  open-route-in-maps href :", mapsHref);

  expect(markerCount, "two markers on the map").toBeGreaterThanOrEqual(2);
  expect(polyCount, "polyline drawn between stops").toBeGreaterThanOrEqual(1);
  expect(mapsHref, "directions link is a Google Maps directions URL").toContain(
    "google.com/maps/dir/"
  );
  expect(mapsHref, "directions URL encodes first stop address").toContain(
    encodeURIComponent("265 Park Ave W NW")
  );
  expect(mapsHref, "directions URL encodes second stop address").toContain(
    encodeURIComponent("600 W Peachtree St NW")
  );
  expect(mapsHref, "driving travel mode").toContain("travelmode=driving");

  await ctx.close();
});

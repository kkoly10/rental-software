import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Phase-2 walk: from a confirmed order through delivery, settlement,
 * and close-out, plus a repeat-customer CRM check. Runs AFTER
 * inflatable.spec.ts so Stages 6/7 have left a confirmed Jordan
 * order behind, and depends on Stage 7b-i creating a delivery route
 * on the same event date so the auto-attach hook in
 * lib/orders/actions.ts:updateOrderStatus picks it up automatically.
 *
 * Stops short of any flow that requires Stripe (balance via Stripe
 * link, deposit refund) — those land once test-mode keys are wired.
 */
export function defineDeliveryAndCloseStages(vertical: string) {
  const RUN_ID = process.env.E2E_RUN_ID ?? `${Date.now().toString(36)}`;
  const SCREENSHOTS = `playwright-e2e-report/${vertical}-phase2-${RUN_ID}`;
  mkdirSync(SCREENSHOTS, { recursive: true });

  test.describe(`${vertical} — phase 2 (delivery + settlement + CRM)`, () => {
    test("Stage 7b-i: operator creates a delivery route for the event date", async ({ page }) => {
      // Stage 6 submitted +14 days as the event date. Match it so the
      // auto-attach hook in updateOrderStatus picks the route up
      // automatically when the confirm fires later.
      const future = new Date();
      future.setDate(future.getDate() + 14);
      const routeDate = future.toISOString().slice(0, 10);

      await page.goto("/dashboard/deliveries");
      await page.screenshot({ path: `${SCREENSHOTS}/20-deliveries-empty.png`, fullPage: true });

      await page.fill('input[name="name"]', "[E2E] Saturday route");
      await page.fill('input[name="route_date"]', routeDate);
      await page.locator('form:has(input[name="route_date"]) button[type="submit"]').click();
      await page.waitForLoadState("networkidle", { timeout: 15_000 });
      await page.screenshot({ path: `${SCREENSHOTS}/21-route-created.png`, fullPage: true });

      // createRoute redirects to /dashboard/deliveries/<id>. If we
      // stayed put a validation error fired — surface it.
      expect(
        page.url(),
        "Create-route form stayed on /deliveries — likely a validation error",
      ).toMatch(/\/dashboard\/deliveries\/[a-f0-9-]+$/);
    });

    test("Stage 7b-ii: confirmed order is on the route (auto-attached or manual)", async ({ page }) => {
      // /dashboard/orders only shows the operator's pipeline — sorted
      // by `created_at DESC`. Phase 2 keeps the storefront's Avery
      // order (auto-confirmed at $0 deposit) at the top; Jordan is
      // below. We want Jordan specifically.
      await page.goto("/dashboard/orders?status=confirmed");
      // First paint occasionally shows "0 orders in your pipeline"
      // even when the DB has just-confirmed rows — likely a per-request
      // Next.js fetch dedup race with the orders table replicating. A
      // forced reload reliably catches up to truth.
      if (
        !(await page.getByRole("link", { name: /jordan/i }).first().isVisible().catch(() => false))
      ) {
        await page.reload();
      }
      const jordanLink = page.getByRole("link", { name: /jordan/i }).first();
      // Some screens render the customer name inside an article tag
      // that the link wraps — fallback if getByRole misses.
      let orderHref: string | null = null;
      if (await jordanLink.isVisible().catch(() => false)) {
        orderHref = await jordanLink.getAttribute("href");
      } else {
        const fallback = page
          .locator('a[href^="/dashboard/orders/"]')
          .filter({ has: page.locator("article") })
          .filter({ hasText: /jordan/i })
          .first();
        await expect(fallback).toBeVisible({ timeout: 10_000 });
        orderHref = await fallback.getAttribute("href");
      }
      expect(orderHref).toBeTruthy();
      await page.goto(orderHref!);
      await page.waitForLoadState("networkidle", { timeout: 10_000 });
      await page.screenshot({ path: `${SCREENSHOTS}/22-order-with-routing.png`, fullPage: true });

      // Two valid post-states: auto-attached (the routing card shows
      // "On route: ..." + a "View route" link) OR manual-attach
      // pending (the routing card shows an "Attach to this route"
      // button). Either is a green Stage 7b-ii.
      const onRouteText = page.getByText(/On route:/i);
      const attachBtn = page.getByRole("button", { name: /attach to this route/i });

      const isOnRoute = await onRouteText.first().isVisible().catch(() => false);
      if (!isOnRoute) {
        await expect(attachBtn.first()).toBeVisible({ timeout: 10_000 });
        await attachBtn.first().click();
        await page.waitForLoadState("networkidle", { timeout: 15_000 });
        await page.reload();
        await expect(onRouteText.first()).toBeVisible({ timeout: 10_000 });
      }
      await page.screenshot({ path: `${SCREENSHOTS}/23-order-attached.png`, fullPage: true });
    });

    test("Stage 7b-iii: pull sheet renders for the route with the attached stop", async ({ page }) => {
      // Navigate via the order detail's "View route" link rather than
      // /dashboard/deliveries — the deliveries board only shows TODAY's
      // routes ("No routes scheduled yet" for future dates), so a
      // future-event-date route is invisible there. This isn't a spec
      // workaround; it's the real path an operator takes when their
      // event is more than a day out.
      await page.goto("/dashboard/orders?status=confirmed");
      const jordanLink = page
        .locator('a[href^="/dashboard/orders/"]')
        .filter({ has: page.locator("article") })
        .filter({ hasText: /jordan/i })
        .first();
      if (!(await jordanLink.isVisible().catch(() => false))) {
        await page.reload();
      }
      await expect(jordanLink).toBeVisible({ timeout: 10_000 });
      await page.goto((await jordanLink.getAttribute("href"))!);
      await page.waitForLoadState("networkidle", { timeout: 10_000 });

      const viewRoute = page.getByRole("link", { name: /view route/i });
      await expect(viewRoute).toBeVisible({ timeout: 10_000 });
      await viewRoute.click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 });
      await page.screenshot({ path: `${SCREENSHOTS}/24-route-detail.png`, fullPage: true });

      const pullSheetLink = page.locator('a[href$="/pull-sheet"]').first();
      await expect(pullSheetLink).toBeVisible({ timeout: 10_000 });
      await pullSheetLink.click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 });
      await page.screenshot({ path: `${SCREENSHOTS}/25-pull-sheet.png`, fullPage: true });

      // The pull sheet has to carry the data the crew actually needs:
      // the route name, the customer name, and the product name. If
      // any is missing the truck rolls without enough information.
      const body = page.locator("body");
      await expect(body).toContainText(/Saturday route/i);
      await expect(body).toContainText(/Jordan/i);
      await expect(body).toContainText(/Castle Bouncer/i);
    });

    test("Stage 7b-iv: operator dispatches the order to delivery", async ({ page }) => {
      await page.goto("/dashboard/orders?status=confirmed");
      const jordanLink = page
        .locator('a[href^="/dashboard/orders/"]')
        .filter({ has: page.locator("article") })
        .filter({ hasText: /jordan/i })
        .first();
      const orderHref = await jordanLink.getAttribute("href");
      await page.goto(orderHref!);
      await page.waitForLoadState("networkidle", { timeout: 10_000 });

      // Ensure full hydration before clicking — without this the React
      // event handler may not be wired up and the click silently
      // no-ops, as observed previously on Mark Confirmed.
      await page.waitForLoadState("networkidle", { timeout: 10_000 });
      const sendBtn = page.getByRole("button", { name: /^send delivery$/i });
      await expect(sendBtn).toBeVisible({ timeout: 10_000 });
      await sendBtn.click();

      // Capture the action's badge before reload — if it returned ok=false
      // (route stop missing, wrong role, etc.) we lose the message on reload.
      const badge = page.locator(".badge.success, .badge.warning").last();
      await expect(badge).toBeVisible({ timeout: 10_000 });
      const badgeText = await badge.innerText();
      test.info().annotations.push({
        type: "result",
        description: `Send-delivery badge: ${JSON.stringify(badgeText)}`,
      });

      await page.waitForLoadState("networkidle", { timeout: 15_000 });
      await page.reload();
      // Durable post-state — order status shows "Out for delivery".
      await expect(page.getByText(/out for delivery/i).first()).toBeVisible({
        timeout: 10_000,
      });
      await page.screenshot({ path: `${SCREENSHOTS}/26-dispatched.png`, fullPage: true });
    });

    test("Stage 7b-v: crew mobile shows today's stops", async ({ page }) => {
      await page.goto("/crew/today");
      await page.screenshot({ path: `${SCREENSHOTS}/27-crew-today.png`, fullPage: true });

      // Crew page should not 500. Whether Jordan's stop appears
      // depends on the event date matching "today" — our test event
      // is +14 days so we don't strictly require the row, only that
      // the page renders without an application error.
      const body = await page.locator("body").innerText();
      expect(/500|application error|internal server error/i.test(body)).toBeFalsy();
    });

    test("Stage 8a: operator creates rental documents", async ({ page }) => {
      // After dispatch the order moved to out_for_delivery — filter
      // accordingly.
      await page.goto("/dashboard/orders?status=out_for_delivery");
      const jordanLink = page
        .locator('a[href^="/dashboard/orders/"]')
        .filter({ has: page.locator("article") })
        .filter({ hasText: /jordan/i })
        .first();
      await expect(jordanLink).toBeVisible({ timeout: 10_000 });
      await page.goto((await jordanLink.getAttribute("href"))!);
      await page.waitForLoadState("networkidle", { timeout: 10_000 });

      // Two label variants observed: "Create documents" (i18n key) and
      // "Generate Documents" (legacy). Match either.
      const createDocsBtn = page
        .getByRole("button", { name: /create documents|generate documents/i })
        .first();
      await expect(createDocsBtn).toBeVisible({ timeout: 10_000 });
      await createDocsBtn.click();
      await page.waitForLoadState("networkidle", { timeout: 15_000 });
      await page.reload();
      // After creation the operator should see at least the rental
      // agreement document row. If only a generic empty state shows,
      // either the action errored or the page didn't refresh.
      await expect(page.getByText(/rental agreement/i).first()).toBeVisible({
        timeout: 10_000,
      });
      await page.screenshot({ path: `${SCREENSHOTS}/28-documents.png`, fullPage: true });
    });

    test("Stage 8b: operator records a balance payment in cash", async ({ page }) => {
      await page.goto("/dashboard/orders?status=out_for_delivery");
      const jordanLink = page
        .locator('a[href^="/dashboard/orders/"]')
        .filter({ has: page.locator("article") })
        .filter({ hasText: /jordan/i })
        .first();
      const orderHref = await jordanLink.getAttribute("href");
      await page.goto(orderHref!);
      await page.waitForLoadState("networkidle", { timeout: 10_000 });

      // Record-payment form. The Stage 6 order's total is $165; the
      // operator collects the full amount in cash on delivery.
      await page.locator('input[name="amount"]').fill("165");
      await page.locator('select[name="payment_type"]').selectOption("balance");
      await page.locator('select[name="payment_method"]').selectOption("cash");

      const submit = page
        .locator('form:has(input[name="amount"]) button[type="submit"]')
        .first();
      await submit.click();
      await page.waitForLoadState("networkidle", { timeout: 15_000 });
      await page.reload();
      await page.screenshot({ path: `${SCREENSHOTS}/29-balance-recorded.png`, fullPage: true });

      // Outstanding balance label should now be $0.00. If the action
      // failed or the RPC silently dropped the payment, the previous
      // $165 number would persist.
      await expect(page.getByText(/\$0\.00/).first()).toBeVisible({ timeout: 10_000 });
    });

    test("Stage 9: repeat customer reuses the existing record", async ({ browser, page }) => {
      // A returning customer (Avery Chen, who booked via Stage 4b)
      // books a second event on the storefront. The case-insensitive
      // email ilike in lib/checkout/actions.ts should reuse the
      // existing customers.id instead of creating a duplicate.
      const customerCtx = await browser.newContext({ ignoreHTTPSErrors: true });
      const customer = await customerCtx.newPage();

      const future = new Date();
      future.setDate(future.getDate() + 35);
      const eventDate = future.toISOString().slice(0, 10);
      const params = new URLSearchParams({
        product: process.env.E2E_PRODUCT_SLUG ?? "e2e-13ft-castle-bouncer",
        date: eventDate,
        zip: process.env.E2E_SERVICE_AREA_ZIP ?? "22554",
      });
      const host = process.env.E2E_STOREFRONT_HOST ?? "couranr.korent.app";
      await customer.goto(`https://${host}/checkout?${params.toString()}`);

      await customer.fill('input[name="first_name"]', "Avery");
      await customer.fill('input[name="last_name"]', "Chen");
      await customer.fill('input[name="phone"]', "5555550199");
      await customer.fill('input[name="email"]', "e2e+customer@example.test");
      await customer.fill('input[name="line1"]', "742 Evergreen Terrace");
      await customer.fill('input[name="city"]', "Stafford");
      await customer.fill('input[name="state"]', "VA");
      await customer.fill('input[name="postal_code"]', process.env.E2E_SERVICE_AREA_ZIP ?? "22554");
      await customer.locator('input[name="terms_accepted"]').check();
      await customer.locator('button[type="submit"]').first().click();
      await customer.waitForLoadState("networkidle", { timeout: 20_000 });
      await expect(customer.getByText(/booking submitted/i)).toBeVisible({ timeout: 10_000 });
      await customerCtx.close();

      // Operator side — customer detail page should now show two
      // orders for Avery. If the email lookup misfired and a duplicate
      // customer row was created, the operator's CRM is polluted on
      // their second-ever repeat customer.
      await page.goto("/dashboard/customers");
      await page.screenshot({ path: `${SCREENSHOTS}/30-customers-list.png`, fullPage: true });

      const averyLink = page.getByRole("link", { name: /avery/i }).first();
      await expect(averyLink).toBeVisible({ timeout: 10_000 });
      await page.goto((await averyLink.getAttribute("href"))!);
      await page.waitForLoadState("networkidle", { timeout: 10_000 });
      await page.screenshot({ path: `${SCREENSHOTS}/31-customer-detail.png`, fullPage: true });

      // Customer detail page lists order history — expect two ORD-*
      // links for Avery.
      const orderLinks = page.locator('a[href^="/dashboard/orders/"]').filter({
        hasText: /ORD-/i,
      });
      const count = await orderLinks.count();
      test.info().annotations.push({
        type: "result",
        description: `Avery's orders on customer detail: ${count}`,
      });
      expect(
        count,
        "Avery should have ≥ 2 orders — repeat customer email match must dedupe",
      ).toBeGreaterThanOrEqual(2);
    });
  });
}

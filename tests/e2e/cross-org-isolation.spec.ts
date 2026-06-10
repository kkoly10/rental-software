import { test, expect } from "@playwright/test";

/**
 * Cross-org isolation — the foundation of multi-tenant trust.
 *
 * Drives the operator (Couranr LLC, via the shared storageState)
 * at direct URLs for resources that belong to a DIFFERENT org and
 * asserts each one is refused — a 404 / not-found, never a 200 that
 * leaks another tenant's data. Every dashboard data loader filters
 * by `organization_id` and calls notFound() on a miss; this proves
 * it end-to-end rather than trusting the code by inspection (gap #1
 * + #22 in docs/qa/pre-launch-gaps.md).
 *
 * The foreign resource IDs default to a real second org on the test
 * project but are env-overridable so the spec can point at a
 * dedicated `[E2E ISOLATION]` org in CI. If the defaults ever 404 at
 * the DATA layer (resource deleted) the test still passes — a
 * not-found is exactly the safe outcome we're asserting.
 */
const FOREIGN = {
  orderId: process.env.E2E_FOREIGN_ORDER_ID ?? "9369007c-3644-4691-85be-e2361a0a3828",
  productId: process.env.E2E_FOREIGN_PRODUCT_ID ?? "fde97902-d2a4-4823-a801-82ac106e4281",
  customerId: process.env.E2E_FOREIGN_CUSTOMER_ID ?? "4458c099-d583-4b06-a378-1b62a97a7dca",
  routeId: process.env.E2E_FOREIGN_ROUTE_ID ?? "1fda358a-898c-4112-9fd7-aa460be2d441",
};

const OPERATOR_EMAIL =
  process.env.E2E_OPERATOR_EMAIL ?? process.env.E2E_INFLATABLE_OPERATOR_EMAIL;
const OPERATOR_PASSWORD =
  process.env.E2E_OPERATOR_PASSWORD ??
  process.env.E2E_INFLATABLE_OPERATOR_PASSWORD;

test.describe("Cross-org isolation", () => {
  test.skip(
    !OPERATOR_EMAIL || !OPERATOR_PASSWORD,
    "Needs E2E_OPERATOR_EMAIL + E2E_OPERATOR_PASSWORD env vars",
  );

  // Each dashboard detail page: a foreign UUID must not render the
  // resource. We assert the page does NOT carry the detail surface's
  // tell-tale markers, and capture the HTTP status for the report.
  const dashboardCases: Array<{
    name: string;
    path: string;
    mustNotContain: RegExp;
  }> = [
    {
      name: "order detail",
      path: `/dashboard/orders/${FOREIGN.orderId}`,
      // Order detail renders a "Record payment" card + a financial
      // summary. Neither should appear for a foreign order.
      mustNotContain: /record payment|outstanding balance/i,
    },
    {
      name: "product detail",
      path: `/dashboard/products/${FOREIGN.productId}`,
      // Product edit page renders the product form with a name field
      // prefilled — a foreign product's name must never load.
      mustNotContain: /save changes|product name/i,
    },
    {
      name: "customer detail",
      path: `/dashboard/customers/${FOREIGN.customerId}`,
      mustNotContain: /order history|customer since/i,
    },
    {
      name: "route detail",
      path: `/dashboard/deliveries/${FOREIGN.routeId}`,
      mustNotContain: /pull sheet|stop sequence|optimize route/i,
    },
  ];

  for (const c of dashboardCases) {
    test(`operator cannot open another org's ${c.name}`, async ({ page }) => {
      const response = await page.goto(c.path);
      const status = response?.status() ?? 0;
      test.info().annotations.push({
        type: "result",
        description: `${c.path} → HTTP ${status}`,
      });

      // The page must not render the foreign resource's detail surface.
      // A 404 / not-found shell is the expected, safe outcome.
      const body = await page.locator("body").innerText();
      expect(
        c.mustNotContain.test(body),
        `${c.name}: foreign resource detail leaked into the page`,
      ).toBeFalsy();

      // Belt and braces: a not-found marker OR a non-200 status. We
      // don't hard-require 404 because Next can render the not-found
      // UI inside a 200 dashboard shell, but one of the two must hold.
      const looksNotFound = /not found|doesn't exist|no longer available|404/i.test(body);
      expect(
        looksNotFound || status >= 400,
        `${c.name}: expected a not-found page or >=400 status, got ${status} with no not-found marker`,
      ).toBeTruthy();
    });
  }

  // API artefact routes (PDF generators) must reject a foreign order
  // outright — these bypass the page shell so a leak here is a raw
  // document download of another tenant's data.
  const apiCases: Array<{ name: string; path: string }> = [
    { name: "invoice PDF", path: `/api/invoices/${FOREIGN.orderId}` },
    { name: "quote PDF", path: `/api/quotes/${FOREIGN.orderId}` },
  ];

  for (const c of apiCases) {
    test(`operator cannot download another org's ${c.name}`, async ({ page }) => {
      const response = await page.request.get(c.path);
      test.info().annotations.push({
        type: "result",
        description: `${c.path} → HTTP ${response.status()}`,
      });
      // Must be refused — 401/403/404. A 200 means the PDF generator
      // produced another tenant's financial document.
      expect(
        response.status(),
        `${c.name}: expected a 4xx refusal, got ${response.status()}`,
      ).toBeGreaterThanOrEqual(400);
    });
  }
});

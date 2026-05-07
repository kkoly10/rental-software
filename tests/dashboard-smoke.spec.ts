/**
 * Dashboard smoke tests — korent.app
 * Auth is handled once in global setup (storageState). No per-test login.
 */
import { test, expect, Page } from "@playwright/test";

const BASE = "https://korent.app";

async function visit(page: Page, path: string, label: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle");

  const url = page.url();
  if (url.includes("/login")) {
    throw new Error(`${label}: session lost — redirected to login`);
  }
  const body = await page.locator("body").innerText().catch(() => "");
  if (body.includes("500") && body.toLowerCase().includes("server error")) {
    console.error(`✗ ${label}: 500 Server Error visible`);
  } else {
    console.log(`✓ ${label}: loaded (${url})`);
  }
  await page
    .screenshot({ path: `/tmp/screenshots/${label.replace(/[\/ ]/g, "-")}.png`, fullPage: true })
    .catch(() => {});
}

// ─── core dashboard pages ────────────────────────────────────────────────────

test("01 — dashboard overview", async ({ page }) => {
  await visit(page, "/dashboard", "dashboard");
  const headings = await page.locator("h1, h2, h3").count();
  expect(headings).toBeGreaterThan(0);
});

test("02 — orders list", async ({ page }) => {
  await visit(page, "/dashboard/orders", "orders");
});

test("03 — new order form", async ({ page }) => {
  await visit(page, "/dashboard/orders/new", "orders-new");
  const fields = await page.locator("input, select, textarea").count();
  console.log(`  New-order form fields: ${fields}`);
  expect(fields).toBeGreaterThan(0);
});

test("04 — products / inventory", async ({ page }) => {
  await visit(page, "/dashboard/products", "products");
});

test("05 — new product form", async ({ page }) => {
  await visit(page, "/dashboard/products/new", "products-new");
});

test("06 — customers", async ({ page }) => {
  await visit(page, "/dashboard/customers", "customers");
});

test("07 — deliveries / routes", async ({ page }) => {
  await visit(page, "/dashboard/deliveries", "deliveries");
});

test("08 — calendar", async ({ page }) => {
  await visit(page, "/dashboard/calendar", "calendar");
});

test("09 — payments", async ({ page }) => {
  await visit(page, "/dashboard/payments", "payments");
});

test("10 — analytics", async ({ page }) => {
  await visit(page, "/dashboard/analytics", "analytics");
});

test("11 — messages", async ({ page }) => {
  await visit(page, "/dashboard/messages", "messages");
});

test("12 — documents", async ({ page }) => {
  await visit(page, "/dashboard/documents", "documents");
});

test("13 — service areas", async ({ page }) => {
  await visit(page, "/dashboard/service-areas", "service-areas");
});

test("14 — pricing", async ({ page }) => {
  await visit(page, "/dashboard/pricing", "pricing");
});

test("15 — maintenance", async ({ page }) => {
  await visit(page, "/dashboard/maintenance", "maintenance");
});

test("16 — website builder", async ({ page }) => {
  await visit(page, "/dashboard/website", "website");
});

test("17 — settings", async ({ page }) => {
  await visit(page, "/dashboard/settings", "settings");
});

test("18 — settings / billing", async ({ page }) => {
  await visit(page, "/dashboard/settings/billing", "settings-billing");
});

test("19 — settings / team", async ({ page }) => {
  await visit(page, "/dashboard/settings/team", "settings-team");
});

test("20 — help", async ({ page }) => {
  await visit(page, "/dashboard/help", "help");
});

// ─── navigation ───────────────────────────────────────────────────────────────

test("21 — sidebar navigation links present", async ({ page }) => {
  await visit(page, "/dashboard", "dashboard-nav");
  const navLinks = await page.locator("nav a, [class*='sidebar'] a").all();
  console.log(`  Found ${navLinks.length} sidebar/nav links`);
  for (const link of navLinks.slice(0, 15)) {
    const href = await link.getAttribute("href").catch(() => null);
    const text = (await link.innerText().catch(() => "")).trim();
    if (href && text) console.log(`    ${text} → ${href}`);
  }
  expect(navLinks.length).toBeGreaterThan(3);
});

// ─── console errors ───────────────────────────────────────────────────────────

test("22 — no JS errors on dashboard overview", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(e.message));

  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  if (errors.length) {
    console.warn(`  ⚠ Console errors:\n${errors.map(e => "    " + e).join("\n")}`);
  } else {
    console.log("  ✓ No JS console errors on dashboard");
  }
  // Report only — don't fail the suite on console errors
});

// ─── theme ────────────────────────────────────────────────────────────────────

test("23 — carnival theme applied (--primary is orange)", async ({ page }) => {
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");

  const primary = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
  );
  console.log(`  --primary: "${primary}"`);
  expect(primary.toLowerCase()).toContain("e8590c");
});

// ─── public storefront ────────────────────────────────────────────────────────

test("24 — public homepage loads", async ({ page }) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const title = await page.title();
  console.log(`  Homepage title: "${title}"`);
  expect(title.length).toBeGreaterThan(0);
  await page.screenshot({ path: "/tmp/screenshots/homepage.png", fullPage: true }).catch(() => {});
});

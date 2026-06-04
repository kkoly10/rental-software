import { test, expect, Page } from "@playwright/test";

/**
 * READ-ONLY live smoke for the Operator Copilot (Phases 1–2).
 * Logs in, opens the Copilot, asks live operational questions, exercises
 * conversation memory, and follows a deep-link to a specific order.
 * Never records a payment or applies any action — no production mutation.
 *
 * Credentials come strictly from env (no secrets in the repo):
 *   TEST_EMAIL=... TEST_PASSWORD=... [E2E_BASE_URL=https://korent.app]
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *   npx playwright test --config tests/e2e/playwright.live.config.ts
 */

const BASE = process.env.E2E_BASE_URL ?? "https://korent.app";
const EMAIL = process.env.TEST_EMAIL ?? "";
const PASSWORD = process.env.TEST_PASSWORD ?? "";

async function dismissOverlays(page: Page) {
  for (const label of ["Close", "Skip", "Skip tour", "Maybe later", "Dismiss", "Got it"]) {
    const btn = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") });
    if (await btn.count()) await btn.first().click({ timeout: 2000 }).catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 45_000 });
  if (!page.url().includes("/dashboard")) await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await dismissOverlays(page);
}

async function openCopilot(page: Page) {
  await page.locator(".copilot-fab").click();
  await expect(page.locator(".copilot-panel")).toBeVisible({ timeout: 15_000 });
}

async function ask(page: Page, question: string): Promise<string> {
  const panel = page.locator(".copilot-panel");
  const before = await panel.locator(".copilot-msg-assistant").count();
  await page.locator('input[aria-label="Ask a question..."]').fill(question);
  await panel.getByRole("button", { name: "Send" }).click();
  await expect
    .poll(async () => panel.locator(".copilot-msg-assistant").count(), { timeout: 45_000 })
    .toBeGreaterThan(before);
  const reply = panel.locator(".copilot-msg-assistant").last();
  await expect.poll(async () => (await reply.innerText()).trim().length, { timeout: 45_000 }).toBeGreaterThan(0);
  const text = (await reply.innerText()).trim();
  console.log(`\n[Q] ${question}\n[A] ${text}\n`);
  return text;
}

test.beforeAll(() => {
  expect(EMAIL, "Set TEST_EMAIL env var").not.toBe("");
  expect(PASSWORD, "Set TEST_PASSWORD env var").not.toBe("");
});

test("operational awareness + memory (read-only)", async ({ page }) => {
  await login(page);
  await openCopilot(page);

  // Phase 1: money owed, and a deep-linked order should be present.
  const owed = await ask(page, "How much am I owed right now?");
  expect(owed.length).toBeGreaterThan(10);
  await page.screenshot({ path: "/tmp/cap-owed.png" });
  const orderLinks = page.locator('.copilot-panel a[href^="/dashboard/orders/"]');
  expect(await orderLinks.count(), "owed answer should include a deep-link to an order").toBeGreaterThan(0);

  // Phase 1: schedule / this week.
  const week = await ask(page, "What events do I have coming up this week?");
  expect(week.length).toBeGreaterThan(10);

  // Phase 1: unread messages.
  const msgs = await ask(page, "Do I have any unread customer messages?");
  expect(msgs.toLowerCase()).toContain("message");

  // Phase 1: revenue this month.
  const month = await ask(page, "How much revenue have I collected this month?");
  expect(month.length).toBeGreaterThan(10);

  // Phase 2: elliptical follow-up must resolve against the prior turn.
  const followup = await ask(page, "And what's the outstanding balance again?");
  expect(followup.length).toBeGreaterThan(10);
  await page.screenshot({ path: "/tmp/cap-memory.png" });
});

test("deep-link navigates to the specific order (read-only)", async ({ page }) => {
  await login(page);
  await openCopilot(page);

  await ask(page, "How much am I owed right now?");
  const firstOrderLink = page.locator('.copilot-panel a[href^="/dashboard/orders/"]').first();
  await expect(firstOrderLink).toBeVisible({ timeout: 10_000 });
  const href = await firstOrderLink.getAttribute("href");
  console.log("[deep-link] navigating to", href);

  await firstOrderLink.click();
  await page.waitForURL(/\/dashboard\/orders\/[0-9a-f-]+/, { timeout: 30_000 });
  expect(page.url()).toContain("/dashboard/orders/");
  // The order detail page should render an order number heading.
  await expect(page.getByText(/ORD-\d{8}-/i).first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "/tmp/cap-deeplink.png" });
});

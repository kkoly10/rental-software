import { test, expect, Page } from "@playwright/test";

/**
 * READ-ONLY live smoke for the Operator Copilot (Phases 1–2).
 * Logs in, opens the Copilot, asks live operational questions, and asserts a
 * real answer renders. Deliberately does NOT record a payment or apply any
 * action — this never mutates production data.
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
  // Best-effort close of any first-run welcome modal / tour so the FAB is clickable.
  for (const label of ["Close", "Skip", "Skip tour", "Maybe later", "Dismiss", "Got it"]) {
    const btn = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") });
    if (await btn.count()) {
      await btn.first().click({ timeout: 2000 }).catch(() => {});
    }
  }
  await page.keyboard.press("Escape").catch(() => {});
}

async function ask(page: Page, question: string): Promise<string> {
  const panel = page.locator(".copilot-panel");
  const before = await panel.locator(".copilot-msg-assistant").count();
  await page.locator('input[aria-label="Ask a question..."]').fill(question);
  await panel.getByRole("button", { name: "Send" }).click();
  // Wait for a new assistant bubble beyond what was there before.
  await expect
    .poll(async () => panel.locator(".copilot-msg-assistant").count(), { timeout: 45_000 })
    .toBeGreaterThan(before);
  const reply = panel.locator(".copilot-msg-assistant").last();
  await expect.poll(async () => (await reply.innerText()).trim().length, { timeout: 45_000 }).toBeGreaterThan(0);
  return (await reply.innerText()).trim();
}

test.beforeAll(() => {
  expect(EMAIL, "Set TEST_EMAIL env var").not.toBe("");
  expect(PASSWORD, "Set TEST_PASSWORD env var").not.toBe("");
});

test("Copilot answers live operational questions in a real browser (read-only)", async ({ page }) => {
  // --- Log in ---
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 45_000 });
  expect(page.url(), "should not still be on the login page").not.toContain("/login");

  if (!page.url().includes("/dashboard")) {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  }
  await dismissOverlays(page);

  // --- Open the Copilot ---
  await page.locator(".copilot-fab").click();
  await expect(page.locator(".copilot-panel")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "/tmp/copilot-01-open.png" });

  // --- Phase 1: money owed (read-only) ---
  const owed = await ask(page, "How much am I owed right now?");
  console.log("\n[owed] >>>\n" + owed + "\n<<<\n");
  await page.screenshot({ path: "/tmp/copilot-02-owed.png" });
  expect(owed.length).toBeGreaterThan(10);

  // --- Phase 1: daily briefing (read-only) ---
  const attention = await ask(page, "What needs my attention today?");
  console.log("\n[attention] >>>\n" + attention + "\n<<<\n");
  await page.screenshot({ path: "/tmp/copilot-03-attention.png" });
  expect(attention.length).toBeGreaterThan(10);

  // --- Phase 2: follow-up should resolve against prior turn ---
  const followup = await ask(page, "And how much did I collect this month?");
  console.log("\n[month] >>>\n" + followup + "\n<<<\n");
  await page.screenshot({ path: "/tmp/copilot-04-month.png" });
  expect(followup.length).toBeGreaterThan(10);
});

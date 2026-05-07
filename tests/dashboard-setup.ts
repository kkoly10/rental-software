/**
 * Playwright global setup — signs in once and saves auth cookies
 * so all smoke tests reuse the same session (avoids rate-limiting).
 */
import { chromium, FullConfig } from "@playwright/test";

const BASE = "https://korent.app";
const EMAIL = process.env.TEST_EMAIL ?? "komlankouhiko@icloud.com";
const PASSWORD = process.env.TEST_PASSWORD ?? "Fuck2chainz!";

export default async function globalSetup(_config: FullConfig) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");

  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  console.log("Global setup: signed in at", page.url());

  await context.storageState({ path: "/tmp/korent-auth.json" });
  await browser.close();
}

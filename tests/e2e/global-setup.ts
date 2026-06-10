import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Signs into the operator account once and saves the browser
 * storage to `playwright/.auth/operator.json` so every test in
 * the suite can reuse it via `storageState`.
 *
 * Without this, each test logs in from scratch and trips the
 * /login rate limiter on /dashboard/* runs of more than ~5 tests.
 *
 * Also handles the Vercel preview share-token cookie so the
 * authenticated state is fully primed for protected previews.
 */
export const STORAGE_STATE_PATH = "playwright/.auth/operator.json";

export default async function globalSetup(config: FullConfig) {
  const email =
    process.env.E2E_OPERATOR_EMAIL ?? process.env.E2E_INFLATABLE_OPERATOR_EMAIL;
  const password =
    process.env.E2E_OPERATOR_PASSWORD ??
    process.env.E2E_INFLATABLE_OPERATOR_PASSWORD;
  if (!email || !password) {
    console.warn(
      "[e2e:setup] no operator creds in env — skipping shared login. " +
        "Tests in the authenticated suite will skip.",
    );
    return;
  }

  const baseURL =
    config.projects[0].use.baseURL ??
    process.env.E2E_BASE_URL ??
    "https://korent.app";
  const bypass = process.env.E2E_VERCEL_BYPASS_TOKEN;

  mkdirSync(dirname(STORAGE_STATE_PATH), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  if (bypass) {
    // First request through the share token sets the bypass cookie
    // on this context — subsequent navigation can use the bare URL.
    await page.goto(`${baseURL}/?_vercel_share=${bypass}`);
  }

  await page.goto(`${baseURL}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}

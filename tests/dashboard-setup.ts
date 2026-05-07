/**
 * Playwright global setup — signs in once and saves auth cookies
 * so all smoke tests reuse the same session (avoids rate-limiting).
 */
import { chromium, FullConfig } from "@playwright/test";
import * as fs from "fs";

const BASE = "https://korent.app";
const EMAIL = process.env.TEST_EMAIL ?? "komlankouhiko@icloud.com";
const PASSWORD = process.env.TEST_PASSWORD ?? "Fuck2chainz!";

export default async function globalSetup(_config: FullConfig) {
  fs.mkdirSync("/tmp/screenshots", { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // Capture console errors
  page.on("console", m => { if (m.type() === "error") console.error("BROWSER:", m.text()); });

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  console.log("Setup: on page", page.url());

  await page.screenshot({ path: "/tmp/screenshots/setup-01-login.png" });

  // Fill the form
  const emailInput = page.locator('input[name="email"]');
  const passInput = page.locator('input[name="password"]');
  const submitBtn = page.locator('button[type="submit"]');

  console.log("Setup: email inputs found:", await emailInput.count());
  console.log("Setup: password inputs found:", await passInput.count());
  console.log("Setup: submit buttons found:", await submitBtn.count());

  await emailInput.fill(EMAIL);
  await passInput.fill(PASSWORD);

  await page.screenshot({ path: "/tmp/screenshots/setup-02-filled.png" });
  await submitBtn.click();

  // Wait briefly then capture state
  await page.waitForTimeout(5000);
  const urlAfterClick = page.url();
  console.log("Setup: URL 5s after submit:", urlAfterClick);
  await page.screenshot({ path: "/tmp/screenshots/setup-03-after-submit.png" });

  // Check for error messages
  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (bodyText.includes("Too many") || bodyText.includes("rate") || bodyText.includes("wait")) {
    console.error("Setup: rate limit message detected:", bodyText.slice(0, 300));
  }
  if (bodyText.includes("Invalid") || bodyText.includes("incorrect") || bodyText.includes("wrong")) {
    console.error("Setup: credentials error detected:", bodyText.slice(0, 300));
  }

  if (urlAfterClick.includes("/dashboard")) {
    console.log("Setup: signed in successfully at", urlAfterClick);
  } else {
    // Try waiting longer
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 25000 });
      console.log("Setup: redirected to", page.url());
    } catch {
      await page.screenshot({ path: "/tmp/screenshots/setup-04-timeout.png" });
      const finalBody = await page.locator("body").innerText().catch(() => "");
      console.error("Setup: sign-in failed. URL:", page.url());
      console.error("Setup: page text snippet:", finalBody.slice(0, 500));
      throw new Error(`Sign-in did not redirect to /dashboard. Current URL: ${page.url()}`);
    }
  }

  await context.storageState({ path: "/tmp/korent-auth.json" });
  console.log("Setup: session saved to /tmp/korent-auth.json");
  await browser.close();
}

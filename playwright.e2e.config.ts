import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end vertical walkthrough config.
 *
 * Separate from playwright.config.ts (which runs the API smoke
 * suite in CI). This one points at live production by default
 * and drives a headed-by-default browser through the operator +
 * customer journey for one vertical at a time.
 *
 * Usage:
 *   npm run test:e2e -- --grep inflatable
 *   E2E_BASE_URL=https://korent.app npm run test:e2e
 *
 * Findings get written to docs/qa/vertical-walkthroughs.md as the
 * spec runs; the spec itself just exercises code paths + screenshots
 * each stage so a human can verify the visual / copy.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Walkthroughs hit real APIs (auth, Supabase, Stripe). 60s per
  // step lets slow OAuth redirects + email-link flows breathe.
  timeout: 120_000,
  retries: 0,
  // Sequential so the test_org rows in the DB don't race each other —
  // a parallel signup would land two `[E2E TEST] Inflatable` orgs.
  workers: 1,

  // Sign in once, reuse the cookie across every test. Without this
  // each test triggers the /login rate limiter after ~5 attempts.
  globalSetup: require.resolve("./tests/e2e/global-setup.ts"),

  use: {
    storageState: "playwright/.auth/operator.json",
    baseURL: process.env.E2E_BASE_URL ?? "https://korent.app",
    // The sandboxed container's chromium can have a stale CA bundle
    // that rejects valid prod certs (mirrors the smoke config). The
    // harness is for our own production domain; trust it.
    ignoreHTTPSErrors: true,
    // Capture screenshots + traces always — they're the artefact
    // the human reviewer cross-references against the findings doc.
    screenshot: "on",
    trace: "on",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-e2e-report", open: "never" }],
  ],

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Tier-2 launch hardening — operators check the dashboard from a
      // tablet during events, crew works from phones in the field, and
      // customers complete checkout on whatever they're holding. A
      // separate mobile project lets us run the mobile-only specs
      // (tests/e2e/mobile-*.spec.ts) without re-running every desktop
      // walk at half the viewport.
      name: "mobile",
      testMatch: /mobile-.*\.spec\.ts/,
      // Pixel 5 = Chromium-based mobile profile. iPhone 13 would
      // require pulling WebKit (~150MB extra browser); Pixel covers
      // the layout failure modes (touch viewport, mobile UA, no
      // pointer hover) without the dependency. Override with
      // E2E_MOBILE_DEVICE to test a specific device profile.
      use: {
        ...devices[process.env.E2E_MOBILE_DEVICE ?? "Pixel 5"],
      },
    },
  ],
});

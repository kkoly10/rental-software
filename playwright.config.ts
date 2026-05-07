import { defineConfig } from "@playwright/test";

/**
 * Smoke test config for API route testing.
 *
 * Usage:
 *   npm run test:smoke                      # starts dev server automatically
 *   BASE_URL=https://myapp.vercel.app npm run test:smoke  # test against deployed URL
 */
export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    extraHTTPHeaders: {
      Accept: "application/json",
    },
    ignoreHTTPSErrors: true,
  },

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  // Start dev server when no BASE_URL provided.
  // Reuses an already-running server in local dev to avoid startup delays.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

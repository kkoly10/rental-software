import { defineConfig } from "@playwright/test";

// Standalone config for a READ-ONLY live smoke against the deployed app.
// No webServer — targets a real deployment (default korent.app).
export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
    actionTimeout: 30_000,
  },
  reporter: [["list"]],
});

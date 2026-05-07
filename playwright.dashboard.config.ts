import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "dashboard-smoke.spec.ts",
  timeout: 60_000,
  workers: 1,
  globalSetup: "./tests/dashboard-setup.ts",
  use: {
    baseURL: "https://korent.app",
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    storageState: "/tmp/korent-auth.json",
    video: "off",
  },
  reporter: [["list"]],
});

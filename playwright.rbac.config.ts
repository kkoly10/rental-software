import { defineConfig } from "@playwright/test";

/**
 * RBAC / RLS verification suite.
 *
 * Unlike the API smoke suite (which boots the app in demo mode and only
 * asserts routes don't 500), this hits the REAL Supabase PostgREST + RPC
 * endpoints with per-role JWTs and asserts the row-level-security matrix
 * directly — the actual security boundary.
 *
 * It is env-gated: with no RBAC_SUPABASE_URL it skips entirely, so it never
 * runs (or breaks) in the demo-mode CI smoke job. To run it you need a seeded
 * fixture (org + owner/viewer/new-invitee users + an order/item/invite) and:
 *
 *   RBAC_SUPABASE_URL=...  RBAC_ANON_KEY=...  RBAC_TEST_PASSWORD=...
 *   RBAC_ORG_ID=...  RBAC_ORDER_ID=...  RBAC_ORDER_ITEM_ID=...
 *   RBAC_VIEWER_ID=...  RBAC_INVITE_TOKEN=...
 *   npx playwright test --config playwright.rbac.config.ts
 */
export default defineConfig({
  testDir: "./tests/rls",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: { ignoreHTTPSErrors: true },
});

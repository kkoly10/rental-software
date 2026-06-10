import { defineDeliveryAndCloseStages } from "./vertical-journey-phase2";

/**
 * Phase 2 of the inflatable walk — MUST run AFTER inflatable.spec.ts
 * (Stage 6/7 leave behind the confirmed Jordan order these stages
 * drive). Playwright orders spec files alphabetically, which is why
 * this file is named `inflatable2` and not `inflatable-phase2`:
 * "-" sorts before "." so the old name ran Phase 2 FIRST against a
 * freshly-reset empty org, and every stage failed on missing data.
 *
 * Run both:
 *   npm run test:e2e tests/e2e/inflatable.spec.ts tests/e2e/inflatable2.spec.ts
 */
defineDeliveryAndCloseStages("inflatable");

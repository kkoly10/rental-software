import { defineDeliveryAndCloseStages } from "./vertical-journey-phase2";

/**
 * Phase 2 of the inflatable walk — runs AFTER inflatable.spec.ts (so
 * Stage 6/7 have left a confirmed Jordan order behind). Drives the
 * operator from delivery routing through balance settlement and a
 * repeat-customer CRM check.
 *
 * Run sequentially after the Stage 1-7 spec:
 *   npm run test:e2e tests/e2e/inflatable.spec.ts
 *   npm run test:e2e tests/e2e/inflatable-phase2.spec.ts
 */
defineDeliveryAndCloseStages("inflatable");

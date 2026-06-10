import { defineDeliveryAndCloseStages } from "./vertical-journey-phase2";

/**
 * Phase 2 of the concessions walk — runs AFTER concessions.spec.ts.
 * Set E2E_PRODUCT_SLUG to the vertical's product slug before running.
 */
defineDeliveryAndCloseStages("concessions");

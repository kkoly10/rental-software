import { defineDeliveryAndCloseStages } from "./vertical-journey-phase2";

/**
 * Phase 2 of the tents walk — runs AFTER tents.spec.ts.
 * Set E2E_PRODUCT_SLUG to the vertical's product slug before running.
 */
defineDeliveryAndCloseStages("tents");

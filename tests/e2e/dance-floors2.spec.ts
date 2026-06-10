import { defineDeliveryAndCloseStages } from "./vertical-journey-phase2";

/**
 * Phase 2 of the dance-floors walk — runs AFTER dance-floors.spec.ts.
 * Set E2E_PRODUCT_SLUG to the vertical's product slug before running.
 */
defineDeliveryAndCloseStages("dance-floors");

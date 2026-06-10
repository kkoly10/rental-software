import { defineDeliveryAndCloseStages } from "./vertical-journey-phase2";

/**
 * Phase 2 of the tables-and-chairs walk — runs AFTER tables-and-chairs.spec.ts.
 * Set E2E_PRODUCT_SLUG to the vertical's product slug before running.
 */
defineDeliveryAndCloseStages("tables-and-chairs");

import { defineDeliveryAndCloseStages } from "./vertical-journey-phase2";

/**
 * Phase 2 of the photo-booths walk — runs AFTER photo-booths.spec.ts.
 * Set E2E_PRODUCT_SLUG to the vertical's product slug before running.
 */
defineDeliveryAndCloseStages("photo-booths");

import { defineVerticalJourney } from "./vertical-journey";

/**
 * Tables & chairs — banquet inventory operators.
 *
 * Run solo (org must be flipped to this vertical + reset first):
 *   npm run test:e2e tests/e2e/tables-and-chairs.spec.ts
 */
defineVerticalJourney({
  vertical: "tables-and-chairs",
  marketingPath: "/tables-and-chairs-rental-software",
  marketingTitle: /Table & Chair Rental Software/i,
  emptyProductsCopy: /no tables or chairs yet/i,
  starterName: /Chiavari Chair/i,
  categoryPattern: /chiavari/i,
  productName: "[E2E] Chiavari Chair Gold",
  productPrice: "3.50",
  productDescription:
    "Classic Chiavari chair with cushion. 50-chair minimum order. Stackable for easy delivery.",
  productSlug: "e2e-chiavari-chair-gold",
  // A realistic event order is ~100 chairs — a bare $3.50 subtotal
  // would (rightly) reject the $50 deposit as greater than the total.
  orderSubtotal: "350",
  // A single $3.50 chair sits below the org's $100 service-area
  // minimum, so the storefront deep-link checkout correctly rejects —
  // covers the below-minimum edge-case row of the QA matrix.
  checkoutBelowMinimum: true,
});

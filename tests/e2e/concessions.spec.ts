import { defineVerticalJourney } from "./vertical-journey";

/**
 * Concessions — popcorn / snow cone / cotton candy machine operators.
 *
 * Run solo (org must be flipped to this vertical + reset first):
 *   npm run test:e2e tests/e2e/concessions.spec.ts
 */
defineVerticalJourney({
  vertical: "concessions",
  marketingPath: "/concession-rental-software",
  marketingTitle: /Concession/i,
  emptyProductsCopy: /no machines yet/i,
  starterName: /Popcorn Machine/i,
  categoryPattern: /popcorn/i,
  productName: "[E2E] Popcorn Machine",
  productPrice: "175",
  productDescription:
    "16oz commercial popper, serves ~200 guests. Kernels + bags + butter included. Standard 110V power.",
  productSlug: "e2e-popcorn-machine",
});

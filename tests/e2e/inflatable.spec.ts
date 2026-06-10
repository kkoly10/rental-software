import { defineVerticalJourney } from "./vertical-journey";

/**
 * Inflatable — the day-one reference vertical.
 *
 * Run solo (org must be flipped to this vertical + reset first):
 *   npm run test:e2e tests/e2e/inflatable.spec.ts
 */
defineVerticalJourney({
  vertical: "inflatable",
  marketingPath: "/inflatable-rental-software",
  marketingTitle: /Inflatable/i,
  emptyProductsCopy: /no bouncers yet/i,
  starterName: /13ft Castle Bouncer/i,
  categoryPattern: /bounce/i,
  productName: "[E2E] 13ft Castle Bouncer",
  productPrice: "165",
  productDescription:
    "Classic 13×13 castle inflatable for kids ages 3-10. Stakes + blower + safety overview included.",
  productSlug: "e2e-13ft-castle-bouncer",
});

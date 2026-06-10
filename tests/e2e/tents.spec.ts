import { defineVerticalJourney } from "./vertical-journey";

/**
 * Tents — wedding + event canopy operators.
 *
 * Run solo (org must be flipped to this vertical + reset first):
 *   npm run test:e2e tests/e2e/tents.spec.ts
 */
defineVerticalJourney({
  vertical: "tents",
  marketingPath: "/tent-rental-software",
  marketingTitle: /Tent Rental Software/i,
  emptyProductsCopy: /no tents yet/i,
  starterName: /20x40 Frame Tent/i,
  categoryPattern: /frame tent/i,
  productName: "[E2E] 20x40 Frame Tent",
  productPrice: "650",
  productDescription:
    "Pole-free frame tent for grass, concrete, or asphalt. Seats ~80 banquet / 60 cocktail. Sidewalls extra.",
  productSlug: "e2e-20x40-frame-tent",
});

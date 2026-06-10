import { defineVerticalJourney } from "./vertical-journey";

/**
 * Photo booths — per-hour event service operators.
 *
 * Run solo (org must be flipped to this vertical + reset first):
 *   npm run test:e2e tests/e2e/photo-booths.spec.ts
 */
defineVerticalJourney({
  vertical: "photo-booths",
  marketingPath: "/photo-booth-rental-software",
  marketingTitle: /Photo Booth Rental Software/i,
  emptyProductsCopy: /no booths yet/i,
  starterName: /Open-Air Photo Booth/i,
  categoryPattern: /open-air/i,
  productName: "[E2E] Open-Air Photo Booth",
  productPrice: "600",
  productDescription:
    "DSLR camera, ring light, 6 backdrop options, prop kit, attendant included. 3-hour minimum. Needs one 110V outlet.",
  productSlug: "e2e-open-air-photo-booth",
});

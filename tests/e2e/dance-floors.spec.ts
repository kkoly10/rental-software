import { defineVerticalJourney } from "./vertical-journey";

/**
 * Dance floors — modular floor + stage section operators.
 *
 * Run solo (org must be flipped to this vertical + reset first):
 *   npm run test:e2e tests/e2e/dance-floors.spec.ts
 */
defineVerticalJourney({
  vertical: "dance-floors",
  marketingPath: "/dance-floor-rental-software",
  marketingTitle: /Dance Floor Rental Software/i,
  emptyProductsCopy: /no dance floors yet/i,
  starterName: /12x12 Parquet Dance Floor/i,
  categoryPattern: /parquet/i,
  productName: "[E2E] 12x12 Parquet Dance Floor",
  productPrice: "450",
  productDescription:
    "Modular parquet sections, 12x12 (sixteen 3x3 panels). Sub-floor included. Indoor or covered tent only.",
  productSlug: "e2e-12x12-parquet-dance-floor",
});

/**
 * Phase 3b — pure money aggregation for the multi-item cart.
 *
 * Extracted so the summing + rounding can be unit-tested in isolation
 * (no DB, no Stripe). The action calls these to fold N per-item subtotals
 * into the single order subtotal the order-level math already uses, and to
 * derive the order total — keeping everything in integer cents until the
 * final boundary so deposit + balance always reconcile to the penny.
 */

/**
 * Sum N per-item dollar subtotals into integer cents. Each item is
 * rounded to the cent FIRST (matching how each line is stored), then
 * summed, so the order subtotal is exactly Σ(round(item × 100)). This is
 * the same value the per-line order_items rows carry, so the order
 * subtotal never drifts from the sum of its lines.
 */
export function sumItemSubtotalsCents(itemSubtotals: number[]): number {
  return itemSubtotals.reduce((acc, s) => acc + Math.round(s * 100), 0);
}

/**
 * Derive the order total in cents from the summed subtotal cents, the
 * delivery fee (dollars), and the already-computed tax cents. Mirrors the
 * single-item path: taxable base = round((subtotal + delivery) × 100),
 * total = taxable base + tax.
 */
export function orderTotalCents(params: {
  subtotalCents: number;
  deliveryFee: number;
  taxCents: number;
}): { taxableBaseCents: number; totalCents: number } {
  const taxableBaseCents = Math.round(
    (params.subtotalCents / 100 + params.deliveryFee) * 100,
  );
  return {
    taxableBaseCents,
    totalCents: taxableBaseCents + params.taxCents,
  };
}

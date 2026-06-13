/**
 * Pure capacity math shared by the display check (lib/availability/check.ts)
 * and mirrored by the atomic reserve RPC
 * (supabase/migrations/.._quantity_aware_availability.sql).
 *
 * Kept dependency-free (no `@/` imports, no I/O) so it can be unit
 * tested directly and so the two enforcement points can't drift on the
 * arithmetic.
 */

export type CapacityInputs = {
  /**
   * Total bookable units in the window. For pooled/bulk products this is
   * products.quantity_on_hand; for serialized products it's the count of
   * bookable asset rows minus any held by an open maintenance record.
   */
  capacity: number;
  /** Sum of units already reserved by overlapping non-expired blocks. */
  reserved: number;
  /** Units the caller wants to reserve now. Clamped to >= 1. */
  requested?: number;
};

/**
 * True when `requested` units still fit within remaining capacity.
 * Zero capacity is always unavailable (no inventory / all in service).
 */
export function hasAvailableCapacity(inputs: CapacityInputs): boolean {
  const requested = Math.max(1, Math.trunc(inputs.requested ?? 1));
  if (inputs.capacity <= 0) return false;
  return inputs.reserved + requested <= inputs.capacity;
}

/** Units still free in the window (never negative). */
export function remainingCapacity(capacity: number, reserved: number): number {
  return Math.max(0, capacity - reserved);
}

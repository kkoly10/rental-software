import type { Capability } from "../types.ts";

/**
 * PR-2c — damage-waiver capability.
 *
 * Optional surcharge customers can opt into at checkout to cap their
 * liability for accidental damage. Industry standard ~8-12% of rental
 * subtotal; the operator sets a per-product rate in basis points on
 * `products.damage_waiver_rate_bps`.
 *
 * Gated as a capability so the operator product form (and any future
 * customer-facing PDP checkbox) only surfaces it for products the
 * operator has explicitly opted in. Without this gate, a bouncer
 * operator who has no industry context for waivers could leave the
 * field populated by accident.
 *
 * Vertical fit:
 *   - tents, dance-floors, photo-booths: standard (high damage exposure)
 *   - inflatable, tables-and-chairs, concessions: rarely offered
 *     (operators typically eat low-grade damage)
 */
export const damageWaiver: Capability = {
  slug: "order.damage-waiver",
  group: "order",
  i18nKey: "capabilities.order.damageWaiver",
};

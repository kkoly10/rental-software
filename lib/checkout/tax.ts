import type { SupabaseClient } from "@supabase/supabase-js";

export interface TaxComputation {
  taxCents: number;
  rateBps: number;
  label: string | null;
}

/**
 * Look up the applicable tax rule for a delivery address and compute the
 * tax owed on a given taxable base (subtotal + delivery_fee, minus any
 * discount). Returns zeros + label=null when no rule matches — that's
 * the operator's opt-in: a missing jurisdiction means we don't charge.
 *
 * Lookup precedence:
 *   1. (organization_id, state, postal_code) exact match
 *   2. (organization_id, state, postal_code IS NULL) state-wide fallback
 *   3. no row → 0
 */
export async function computeOrderTax(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    state: string | null;
    postalCode: string | null;
    taxableBaseCents: number;
  }
): Promise<TaxComputation> {
  const { organizationId, state, postalCode, taxableBaseCents } = params;

  if (!state || taxableBaseCents <= 0) {
    return { taxCents: 0, rateBps: 0, label: null };
  }

  const normalizedState = state.trim().toUpperCase().slice(0, 2);
  if (normalizedState.length !== 2) {
    return { taxCents: 0, rateBps: 0, label: null };
  }

  let rule: { rate_bps: number; label: string; postal_code: string | null } | null = null;

  if (postalCode) {
    const { data: exact } = await supabase
      .from("tax_rules")
      .select("rate_bps, label, postal_code")
      .eq("organization_id", organizationId)
      .eq("state", normalizedState)
      .eq("postal_code", postalCode)
      .is("deleted_at", null)
      .maybeSingle();
    rule = exact ?? null;
  }

  if (!rule) {
    const { data: fallback } = await supabase
      .from("tax_rules")
      .select("rate_bps, label, postal_code")
      .eq("organization_id", organizationId)
      .eq("state", normalizedState)
      .is("postal_code", null)
      .is("deleted_at", null)
      .maybeSingle();
    rule = fallback ?? null;
  }

  if (!rule) {
    return { taxCents: 0, rateBps: 0, label: null };
  }

  const taxCents = Math.round((taxableBaseCents * rule.rate_bps) / 10000);
  return { taxCents, rateBps: rule.rate_bps, label: rule.label };
}

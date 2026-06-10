import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SavedPaymentMethodSummary = {
  id: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
};

/**
 * Load the saved cards Stripe webhook mirrored onto payment_methods
 * for one customer. Used by the operator's "Charge for damage" form
 * so the picker only ever shows cards that belong to THIS order's
 * customer — server-side filtered + RLS-gated.
 */
export async function getCustomerPaymentMethods(
  organizationId: string,
  customerId: string | null
): Promise<SavedPaymentMethodSummary[]> {
  if (!customerId || !hasSupabaseEnv()) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("payment_methods")
    .select("id, card_brand, card_last4, card_exp_month, card_exp_year")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (!data) return [];
  return data.map((r) => ({
    id: r.id,
    cardBrand: r.card_brand,
    cardLast4: r.card_last4,
    cardExpMonth: r.card_exp_month,
    cardExpYear: r.card_exp_year,
  }));
}

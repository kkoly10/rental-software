"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mergeOrgSettings } from "@/lib/settings/merge-settings";

export type PricingActionState = {
  ok: boolean;
  message: string;
};

const pricingRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Rule name is required"),
  type: z.enum([
    "weekend",
    "holiday",
    "peak_season",
    "early_bird",
    "last_minute",
    "multi_day",
    "bundle",
  ]),
  adjustment: z.number().min(-100).max(200),
  conditions: z.object({
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    dateRanges: z
      .array(z.object({ start: z.string(), end: z.string() }))
      .optional(),
    daysBeforeEvent: z
      .object({ min: z.number().optional(), max: z.number().optional() })
      .optional(),
    minRentalDays: z.number().min(1).optional(),
    productIds: z.array(z.string()).optional(),
  }),
  isActive: z.boolean(),
  priority: z.number().int().min(0),
});

const pricingRulesArraySchema = z.array(pricingRuleSchema);

export async function savePricingRules(
  _prevState: PricingActionState,
  formData: FormData
): Promise<PricingActionState> {
  const raw = String(formData.get("rules_json") ?? "[]");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Invalid JSON data." };
  }

  const result = pricingRulesArraySchema.safeParse(parsed);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return {
      ok: false,
      message: `Validation error: ${firstError?.message ?? "Invalid rules."}`,
    };
  }

  const rules = result.data;

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: ${rules.length} pricing rule(s) would be saved.`,
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: pricingMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin"].includes(pricingMembership?.role ?? "")) {
    return { ok: false, message: "Only owners and admins can manage pricing rules." };
  }

  const merged = await mergeOrgSettings(supabase, ctx.organizationId, { pricing_rules: rules });
  if (!merged.ok) {
    return { ok: false, message: merged.message };
  }

  revalidatePath("/dashboard/pricing");
  // #368 pricing rules feed getCheckoutPricing and the storefront product
  // detail price displays; without these every customer-facing price stays
  // at the previous rule set until ISR.
  revalidatePath("/checkout");
  revalidatePath("/inventory", "layout");
  return { ok: true, message: `${rules.length} pricing rule(s) saved.` };
}

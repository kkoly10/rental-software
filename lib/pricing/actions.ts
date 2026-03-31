"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

  // Read existing settings
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  const existingSettings = (org?.settings as Record<string, unknown>) ?? {};

  const { error } = await supabase
    .from("organizations")
    .update({
      settings: {
        ...existingSettings,
        pricing_rules: rules,
      },
    })
    .eq("id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/pricing");
  return { ok: true, message: `${rules.length} pricing rule(s) saved.` };
}

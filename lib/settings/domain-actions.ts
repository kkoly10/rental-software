"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { customDomainSchema } from "@/lib/validation/domains";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: boolean; message: string; savedDomain?: string };

export async function setCustomDomain(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const domain = String(formData.get("domain") ?? "").trim();

  const parsed = customDomainSchema.safeParse({ domain });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid domain." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo: ${parsed.data.domain} would be saved.` };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const supabase = await createSupabaseServerClient();

  // Check if domain is already in use by another org
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("custom_domain", parsed.data.domain)
    .neq("id", ctx.organizationId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { ok: false, message: "This domain is already in use by another business." };
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      custom_domain: parsed.data.domain,
      custom_domain_verified: false,
    })
    .eq("id", ctx.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/website");
  revalidatePath("/dashboard");

  return { ok: true, message: "Custom domain saved. Follow the DNS instructions to verify it.", savedDomain: parsed.data.domain };
}

export async function removeCustomDomain(): Promise<ActionResult> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo: Domain would be removed." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      custom_domain: null,
      custom_domain_verified: false,
    })
    .eq("id", ctx.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/website");
  revalidatePath("/dashboard");

  return { ok: true, message: "Custom domain removed." };
}

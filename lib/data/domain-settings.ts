import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type DomainSettings = {
  slug: string;
  customDomain: string | null;
  customDomainVerified: boolean;
};

const fallback: DomainSettings = {
  slug: "my-business",
  customDomain: null,
  customDomainVerified: false,
};

export async function getDomainSettings(): Promise<DomainSettings> {
  if (!hasSupabaseEnv()) return fallback;

  const ctx = await getOrgContext();
  if (!ctx) return fallback;

  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("slug, custom_domain, custom_domain_verified")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  if (!org) return fallback;

  return {
    slug: org.slug,
    customDomain: org.custom_domain ?? null,
    customDomainVerified: org.custom_domain_verified ?? false,
  };
}

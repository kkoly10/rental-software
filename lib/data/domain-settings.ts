import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

export type DomainSettings = {
  slug: string;
  customDomain: string | null;
  customDomainVerified: boolean;
};

const fallback: DomainSettings = {
  slug: "",
  customDomain: null,
  customDomainVerified: false,
};

export async function getDomainSettings(): Promise<DomainSettings> {
  if (!hasSupabaseEnv()) return fallback;

  // Authenticate the user via their session cookie
  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return fallback;

  // Use the admin client so RLS never blocks this internal dashboard lookup
  const admin = createSupabaseAdminClient();

  const { data: membership } = await admin
    .from("organization_memberships")
    .select("organization_id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return fallback;

  const { data: org } = await admin
    .from("organizations")
    .select("slug, custom_domain, custom_domain_verified")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (!org) return fallback;

  return {
    slug: org.slug,
    customDomain: org.custom_domain ?? null,
    customDomainVerified: org.custom_domain_verified ?? false,
  };
}

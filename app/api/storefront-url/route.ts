import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildStorefrontUrl } from "@/lib/storefront/url";

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("slug, custom_domain, custom_domain_verified")
    .eq("id", ctx.organizationId)
    .single();

  if (error || !org) {
    return NextResponse.json({ error: "Unable to resolve storefront URL." }, { status: 500 });
  }

  const url = buildStorefrontUrl({
    slug: org.slug,
    customDomain: org.custom_domain,
    customDomainVerified: org.custom_domain_verified ?? false,
  });

  return NextResponse.json({ url });
}

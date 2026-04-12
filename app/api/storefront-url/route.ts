import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildStorefrontUrl } from "@/lib/storefront/url";
import { headers } from "next/headers";

export async function GET() {
  const headersList = await headers();
  const requestHost = headersList.get("host") ?? undefined;

  if (!hasSupabaseEnv()) {
    // In local dev without Supabase, point to the local root URL
    const bare = (requestHost ?? "localhost").split(":")[0];
    const isLocal = bare === "localhost" || bare === "127.0.0.1";
    const url = isLocal ? `http://${requestHost ?? "localhost:3000"}` : "/";
    return NextResponse.json({ url });
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

  const url = buildStorefrontUrl(
    {
      slug: org.slug,
      customDomain: org.custom_domain,
      customDomainVerified: org.custom_domain_verified ?? false,
    },
    requestHost,
  );

  return NextResponse.json({ url });
}

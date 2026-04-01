import { NextRequest, NextResponse } from "next/server";
import dns from "dns/promises";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getRequestClientKey } from "@/lib/security/request-client";

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const clientKey = getRequestClientKey(request);
    const limit = await enforceRateLimit({
      scope: "domains:verify",
      actor: clientKey,
      limit: 10,
      windowSeconds: 300,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please wait." },
        { status: 429 }
      );
    }
  } catch {
    // Allow through if rate limiting unavailable
  }

  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("custom_domain, custom_domain_verified")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  if (!org?.custom_domain) {
    return NextResponse.json(
      { error: "No custom domain configured." },
      { status: 400 }
    );
  }

  if (org.custom_domain_verified) {
    return NextResponse.json({ verified: true, domain: org.custom_domain });
  }

  const domain = org.custom_domain;
  let verified = false;

  try {
    // Check CNAME records
    const cnameRecords: string[] = await dns.resolveCname(domain).catch(() => [] as string[]);
    if (
      cnameRecords.some(
        (r) =>
          r === "cname.vercel-dns.com" ||
          r.endsWith(".vercel-dns.com")
      )
    ) {
      verified = true;
    }

    // Check A records (for apex domains)
    if (!verified) {
      const aRecords: string[] = await dns.resolve4(domain).catch(() => [] as string[]);
      if (aRecords.includes("76.76.21.21")) {
        verified = true;
      }
    }
  } catch {
    // DNS lookup failed — not verified
  }

  if (verified) {
    await supabase
      .from("organizations")
      .update({ custom_domain_verified: true })
      .eq("id", ctx.organizationId);

    return NextResponse.json({ verified: true, domain });
  }

  return NextResponse.json({
    verified: false,
    domain,
    message:
      "DNS records not found yet. Make sure your CNAME points to cname.vercel-dns.com, or your A record points to 76.76.21.21. DNS changes can take up to 48 hours.",
  });
}

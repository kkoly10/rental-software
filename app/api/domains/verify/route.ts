import { NextRequest, NextResponse } from "next/server";
import dns from "dns/promises";
import crypto from "node:crypto";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getRequestClientKey } from "@/lib/security/request-client";

// dns/promises has no built-in timeout; bound each lookup so a slow resolver
// can't hang the serverless invocation.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

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
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: verifyMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin"].includes(verifyMembership?.role ?? "")) {
    return NextResponse.json({ error: "Only owners and admins can verify domains." }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("custom_domain, custom_domain_verified, settings")
    .eq("id", ctx.organizationId)
    .is("deleted_at", null)
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
  const settings = (org.settings as Record<string, unknown>) ?? {};

  // Per-org ownership token: anyone can point a domain at the shared Vercel
  // ingress, so pointing-to-Vercel alone does NOT prove ownership. Require a
  // TXT record only the domain's real owner can publish. Generate+persist the
  // token on first verify if it doesn't exist yet.
  let token = typeof settings.domain_verification_token === "string"
    ? settings.domain_verification_token
    : "";
  if (!token) {
    token = crypto.randomBytes(16).toString("hex");
    await supabase
      .from("organizations")
      .update({ settings: { ...settings, domain_verification_token: token } })
      .eq("id", ctx.organizationId)
      .is("deleted_at", null);
  }

  const txtName = `_korent-verify.${domain}`;
  const expectedTxt = `korent-verify=${token}`;

  // Ownership: the verification TXT record must be present.
  const txtRecords = await withTimeout(dns.resolveTxt(txtName), 5000, [] as string[][]);
  const flatTxt = txtRecords.map((parts) => parts.join(""));
  const ownershipProven = flatTxt.includes(expectedTxt) || flatTxt.includes(token);

  // Routing: the domain must also point at Vercel.
  let pointsToVercel = false;
  const cnameRecords = await withTimeout(dns.resolveCname(domain), 5000, [] as string[]);
  if (cnameRecords.some((r) => r === "cname.vercel-dns.com" || r.endsWith(".vercel-dns.com"))) {
    pointsToVercel = true;
  }
  if (!pointsToVercel) {
    const aRecords = await withTimeout(dns.resolve4(domain), 5000, [] as string[]);
    if (aRecords.includes("76.76.21.21")) pointsToVercel = true;
  }

  const verified = ownershipProven && pointsToVercel;

  if (verified) {
    await supabase
      .from("organizations")
      .update({ custom_domain_verified: true })
      .eq("id", ctx.organizationId)
      .is("deleted_at", null);

    return NextResponse.json({ verified: true, domain });
  }

  return NextResponse.json({
    verified: false,
    domain,
    verificationRecord: { type: "TXT", name: txtName, value: expectedTxt },
    message: !ownershipProven
      ? `Add a TXT record at "${txtName}" with the value "${expectedTxt}" to prove ownership, then point the domain to Vercel (CNAME → cname.vercel-dns.com, or A → 76.76.21.21). DNS changes can take up to 48 hours.`
      : "Ownership confirmed. Now point the domain to Vercel (CNAME → cname.vercel-dns.com, or A → 76.76.21.21). DNS changes can take up to 48 hours.",
  });
}

import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { updateSlugSchema } from "@/lib/validation/domains";
import { isSlugAvailable } from "@/lib/auth/resolve-org";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getRequestClientKey } from "@/lib/security/request-client";
import { isAllowedRequestOrigin } from "@/lib/security/request-origin";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

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
      scope: "domains:update-slug",
      actor: clientKey,
      limit: 10,
      windowSeconds: 300,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait." },
        { status: 429 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = updateSlugSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid slug." },
      { status: 400 }
    );
  }

  const { slug } = parsed.data;

  const supabase = await createSupabaseServerClient();

  const { data: slugMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin"].includes(slugMembership?.role ?? "")) {
    return NextResponse.json({ error: "Only owners and admins can change the subdomain." }, { status: 403 });
  }

  const available = await isSlugAvailable(slug);
  if (!available) {
    // Check if the slug belongs to the current org (no change needed)
    const { data: currentOrg } = await supabase
      .from("organizations")
      .select("slug")
      .eq("id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (currentOrg?.slug === slug) {
      return NextResponse.json({ ok: true, slug });
    }

    return NextResponse.json(
      { error: "This slug is already taken or reserved." },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("organizations")
    .update({ slug })
    .eq("id", ctx.organizationId)
    .is("deleted_at", null);

  if (error) {
    console.error("[update-slug] DB update failed:", error.message);
    const message = error.code === "23505"
      ? "That subdomain is already taken. Please choose a different one."
      : "Unable to update subdomain. Please try again.";
    return NextResponse.json({ error: message }, { status: error.code === "23505" ? 409 : 500 });
  }

  revalidatePath("/dashboard/website");
  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, slug });
}

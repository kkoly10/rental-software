import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";

export async function GET() {
  const ctx = await getOrgContext();

  let organizationName: string | null = null;
  if (ctx?.organizationId && hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    organizationName = data?.name ?? null;
  }

  return NextResponse.json(
    {
      businessType: ctx?.businessType ?? "inflatable",
      organizationId: ctx?.organizationId ?? null,
      organizationName,
    },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}

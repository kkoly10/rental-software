import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { listUserOrgs } from "@/lib/auth/switch-org";

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

  // Memberships list drives the sidebar org-switcher dropdown (decision
  // 3.1). When the user has only one we still return it; the client
  // component renders a static label rather than a dropdown.
  const memberships = await listUserOrgs();

  return NextResponse.json(
    {
      businessType: ctx?.businessType ?? "inflatable",
      organizationId: ctx?.organizationId ?? null,
      organizationName,
      memberships,
    },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}

import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { listUserOrgs } from "@/lib/auth/switch-org";
import { getPrimaryVerticalSlug } from "@/lib/verticals/org-verticals";

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
  // Phase 4 follow-up — primary vertical via the join-table helper.
  // The dashboard shell uses businessType to filter the sidebar nav,
  // so a multi-vertical operator who promoted a non-inflatable
  // primary previously still saw the inflatable-shaped sidebar
  // (no Tents-specific items would have differed yet, but the
  // helper is the canonical answer regardless).
  const [memberships, primaryVertical] = await Promise.all([
    listUserOrgs(),
    getPrimaryVerticalSlug(),
  ]);

  return NextResponse.json(
    {
      businessType: primaryVertical ?? ctx?.businessType ?? "inflatable",
      organizationId: ctx?.organizationId ?? null,
      organizationName,
      memberships,
    },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}

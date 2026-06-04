"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/org-cookie";

export type SwitchOrgState = { ok: boolean; message: string };

export type OrgChoice = {
  organizationId: string;
  name: string;
  role: string;
};

/**
 * Returns every active membership for the current user, with the org name.
 * Used by the sidebar OrgSwitcher dropdown. Returns an empty array when
 * Supabase isn't configured or the user isn't authenticated.
 */
export async function listUserOrgs(): Promise<OrgChoice[]> {
  if (!hasSupabaseEnv()) return [];

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations!inner(name, deleted_at)")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(50);

  if (!data) return [];

  return data
    .filter((m) => {
      const org = (m as { organizations?: { deleted_at?: string | null } | null })
        .organizations;
      return !org?.deleted_at;
    })
    .map((m) => {
      const org = (m as { organizations?: { name?: string | null } | null })
        .organizations;
      return {
        organizationId: m.organization_id as string,
        name: org?.name ?? "Organization",
        role: (m.role as string) ?? "member",
      };
    });
}

/**
 * Switch the user's active org. Verifies the user is a member, then writes
 * the active-org cookie (HttpOnly, lax) and revalidates the dashboard so
 * the new org's data renders on next paint.
 *
 * Decision 3.1 — sidebar header switcher pattern (Notion / Linear /
 * Slack). The cookie is HttpOnly so a compromised XSS can't read it; that
 * loses us purely client-side "current org" reads but they're cheap to
 * re-fetch via /api/org-type.
 */
export async function switchActiveOrg(
  organizationId: string
): Promise<SwitchOrgState> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Not authenticated." };
  }

  // Verify membership before writing the cookie. Without this an attacker
  // who knew an org id could trick the server into rendering that org's
  // data via the cookie path (RLS would still block actual writes, but
  // the dashboard would render with stale labels that look real).
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("profile_id", user.id)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    return { ok: false, message: "You're not a member of that organization." };
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: ACTIVE_ORG_COOKIE,
    value: organizationId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // 1-year persistence. The cookie is replaced any time the user
    // switches; the value is opaque and only honoured if a matching
    // active membership still exists at request time.
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Switched." };
}

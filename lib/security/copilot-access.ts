import { cookies } from "next/headers";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/org-cookie";
import type { CopilotRole } from "@/lib/security/copilot-roles";

export type { CopilotRole } from "@/lib/security/copilot-roles";
export {
  COPILOT_CHAT_ROLES,
  COPILOT_ACTION_ROLES,
  copilotRoleAllowed,
} from "@/lib/security/copilot-roles";

export type CopilotAccessContext = {
  userId: string;
  email: string | null;
  organizationId: string;
  role: CopilotRole;
};

export async function getCopilotAccessContext(): Promise<CopilotAccessContext | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email_confirmed_at) {
    return null;
  }

  // Load every active membership so we can honour the active-org cookie the
  // org switcher writes — the same resolution getOrgContext uses. Without this,
  // a multi-org user (e.g. someone who accepted an invite to a second org)
  // would have the Copilot silently act on their oldest org instead of the one
  // they're currently viewing.
  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, created_at")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(50);

  if (!memberships || memberships.length === 0) {
    return null;
  }

  let chosen = memberships[0];
  if (memberships.length > 1) {
    const cookieStore = await cookies();
    const requested = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
    if (requested) {
      const match = memberships.find((m) => m.organization_id === requested);
      if (match) chosen = match;
    }
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    organizationId: chosen.organization_id,
    role: (chosen.role as CopilotRole) ?? "viewer",
  };
}

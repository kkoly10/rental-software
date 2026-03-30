"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  isCurrentUser: boolean;
};

export type PendingInvite = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
};

export type TeamData = {
  members: TeamMember[];
  invites: PendingInvite[];
  currentUserRole: string;
};

export async function getTeamData(): Promise<TeamData> {
  const empty: TeamData = { members: [], invites: [], currentUserRole: "viewer" };

  if (!hasSupabaseEnv()) {
    return {
      members: [
        { id: "demo-1", name: "You (Owner)", email: "owner@example.com", role: "owner", isCurrentUser: true },
        { id: "demo-2", name: "Sarah K.", email: "sarah@example.com", role: "admin", isCurrentUser: false },
        { id: "demo-3", name: "Mike D.", email: "mike@example.com", role: "crew", isCurrentUser: false },
      ],
      invites: [
        { id: "inv-1", email: "newguy@example.com", role: "dispatcher", createdAt: "2026-03-28" },
      ],
      currentUserRole: "owner",
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) return empty;

  const supabase = await createSupabaseServerClient();

  const [{ data: memberships }, { data: invites }] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("id, profile_id, role, profiles(full_name, email)")
      .eq("organization_id", ctx.organizationId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("team_invites")
      .select("id, invited_email, role, created_at")
      .eq("organization_id", ctx.organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  let currentUserRole = "viewer";

  const members: TeamMember[] = (memberships ?? []).map((m) => {
    const profile = m.profiles as unknown as { full_name: string | null; email: string | null } | null;
    const isCurrentUser = m.profile_id === ctx.userId;
    if (isCurrentUser) currentUserRole = m.role;

    return {
      id: m.id,
      name: profile?.full_name ?? profile?.email ?? "Unknown",
      email: profile?.email ?? "",
      role: m.role,
      isCurrentUser,
    };
  });

  const pendingInvites: PendingInvite[] = (invites ?? []).map((inv) => ({
    id: inv.id,
    email: inv.invited_email,
    role: inv.role,
    createdAt: inv.created_at,
  }));

  return { members, invites: pendingInvites, currentUserRole };
}

"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AcceptInviteResult = {
  ok: boolean;
  message: string;
  organizationName?: string;
};

export async function acceptTeamInvite(token: string): Promise<AcceptInviteResult> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Invite would be accepted.", organizationName: "Demo Business" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Please sign in or create an account first, then click the invite link again." };
  }

  const { data: invite } = await supabase
    .from("team_invites")
    .select("id, organization_id, invited_email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return { ok: false, message: "This invite link is invalid." };
  }

  if (invite.status !== "pending") {
    return { ok: false, message: `This invite has already been ${invite.status}.` };
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { ok: false, message: "This invite has expired. Ask your team admin to send a new one." };
  }

  // Verify email matches
  if (user.email?.toLowerCase() !== invite.invited_email.toLowerCase()) {
    return {
      ok: false,
      message: `This invite was sent to ${invite.invited_email}. Please sign in with that email address.`,
    };
  }

  // Atomically claim the invite by transitioning status from pending→accepted.
  // If another request already claimed it, this returns 0 rows and we bail out.
  // This prevents concurrent double-accept without needing a DB transaction.
  const { data: claimed } = await supabase
    .from("team_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .eq("status", "pending")
    .select("id");

  if (!claimed || claimed.length === 0) {
    return { ok: false, message: "This invite has already been accepted." };
  }

  // Check if already a member (race on membership insert)
  const { data: existing } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("organization_id", invite.organization_id)
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    return { ok: false, message: "You're already a member of this organization." };
  }

  // Create membership
  const { error: memberError } = await supabase
    .from("organization_memberships")
    .insert({
      organization_id: invite.organization_id,
      profile_id: user.id,
      role: invite.role,
      status: "active",
    });

  if (memberError) {
    // Roll back the invite claim so it can be retried
    await supabase
      .from("team_invites")
      .update({ status: "pending", accepted_at: null })
      .eq("id", invite.id);
    return { ok: false, message: memberError.message };
  }

  // Get org name for confirmation
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", invite.organization_id)
    .is("deleted_at", null)
    .maybeSingle();

  revalidatePath("/dashboard/settings/team");

  return {
    ok: true,
    message: `Welcome to ${org?.name ?? "the team"}! You now have ${invite.role} access.`,
    organizationName: org?.name ?? undefined,
  };
}

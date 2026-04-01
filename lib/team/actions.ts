"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getActionClientKey } from "@/lib/security/action-client";
import { sendEmail } from "@/lib/email/send";

export type TeamActionState = {
  ok: boolean;
  message: string;
};

const VALID_ROLES = ["admin", "dispatcher", "crew", "viewer"] as const;
type TeamRole = (typeof VALID_ROLES)[number];

function isValidRole(role: string): role is TeamRole {
  return VALID_ROLES.includes(role as TeamRole);
}

// ─── Get current user's role ────────────────────────────────────────────────

async function getCurrentUserRole(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  profileId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();

  return data?.role ?? null;
}

function canManageTeam(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

// ─── Invite team member ─────────────────────────────────────────────────────

export async function inviteTeamMember(
  _prevState: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "viewer");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  if (!isValidRole(role)) {
    return { ok: false, message: "Invalid role selected." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo mode: Invite would be sent to ${email}.` };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  try {
    const clientKey = await getActionClientKey();
    const [userLimit, clientLimit] = await Promise.all([
      enforceRateLimit({ scope: "team:invite:user", actor: ctx.userId, limit: 20, windowSeconds: 3600 }),
      enforceRateLimit({ scope: "team:invite:client", actor: clientKey, limit: 30, windowSeconds: 3600 }),
    ]);

    if (!userLimit.allowed || !clientLimit.allowed) {
      return { ok: false, message: "Too many invite attempts. Please wait." };
    }
  } catch {
    return { ok: false, message: "Unable to send invite right now." };
  }

  const supabase = await createSupabaseServerClient();

  const currentRole = await getCurrentUserRole(supabase, ctx.organizationId, ctx.userId);
  if (!canManageTeam(currentRole)) {
    return { ok: false, message: "Only owners and admins can invite team members." };
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingMember) {
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("profile_id", existingMember.id)
      .eq("status", "active")
      .maybeSingle();

    if (membership) {
      return { ok: false, message: "This person is already a team member." };
    }
  }

  // Check for pending invite
  const { data: pendingInvite } = await supabase
    .from("team_invites")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("invited_email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingInvite) {
    return { ok: false, message: "An invite is already pending for this email." };
  }

  const token = crypto.randomBytes(32).toString("hex");

  const { error } = await supabase.from("team_invites").insert({
    organization_id: ctx.organizationId,
    invited_email: email,
    role,
    invited_by_profile_id: ctx.userId,
    token,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  // Send invite email (non-blocking)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  const businessName = org?.name ?? "Korent";
  const inviteUrl = `${siteUrl}/invite/${token}`;

  sendEmail({
    to: email,
    subject: `You're invited to join ${businessName} on Korent`,
    html: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #dbe6f4;padding:32px;">
        <tr><td>
          <h1 style="margin:0 0 12px;font-size:22px;color:#10233f;">You've been invited!</h1>
          <p style="color:#55708f;font-size:15px;">
            <strong>${businessName}</strong> has invited you to join their team as a <strong>${role}</strong>.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;background:#1e5dcf;color:#fff;border-radius:999px;font-weight:600;font-size:14px;text-decoration:none;margin:20px 0;">
            Accept Invite
          </a>
          <p style="color:#55708f;font-size:13px;">This invite expires in 7 days.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    replyTo: org?.name ? undefined : undefined,
    organizationId: ctx.organizationId,
  }).catch(() => {});

  revalidatePath("/dashboard/settings/team");

  return {
    ok: true,
    message: `Invite sent to ${email} as ${role}.`,
  };
}

// ─── Remove team member ─────────────────────────────────────────────────────

export async function removeTeamMember(
  memberId: string
): Promise<TeamActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Member would be removed." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

  const currentRole = await getCurrentUserRole(supabase, ctx.organizationId, ctx.userId);
  if (!canManageTeam(currentRole)) {
    return { ok: false, message: "Only owners and admins can remove members." };
  }

  // Prevent removing yourself
  const { data: target } = await supabase
    .from("organization_memberships")
    .select("profile_id, role")
    .eq("id", memberId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!target) {
    return { ok: false, message: "Member not found." };
  }

  if (target.profile_id === ctx.userId) {
    return { ok: false, message: "You cannot remove yourself." };
  }

  if (target.role === "owner") {
    return { ok: false, message: "Cannot remove the account owner." };
  }

  const { error } = await supabase
    .from("organization_memberships")
    .update({ status: "removed" })
    .eq("id", memberId)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/settings/team");
  return { ok: true, message: "Team member removed." };
}

// ─── Update member role ─────────────────────────────────────────────────────

export async function updateMemberRole(
  memberId: string,
  newRole: string
): Promise<TeamActionState> {
  if (!isValidRole(newRole)) {
    return { ok: false, message: "Invalid role." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo mode: Role would be updated to ${newRole}.` };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

  const currentRole = await getCurrentUserRole(supabase, ctx.organizationId, ctx.userId);
  if (!canManageTeam(currentRole)) {
    return { ok: false, message: "Only owners and admins can change roles." };
  }

  const { data: target } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("id", memberId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!target) {
    return { ok: false, message: "Member not found." };
  }

  if (target.role === "owner") {
    return { ok: false, message: "Cannot change the owner's role." };
  }

  const { error } = await supabase
    .from("organization_memberships")
    .update({ role: newRole })
    .eq("id", memberId)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/settings/team");
  return { ok: true, message: `Role updated to ${newRole}.` };
}

// ─── Cancel pending invite ──────────────────────────────────────────────────

export async function cancelInvite(
  inviteId: string
): Promise<TeamActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Invite would be cancelled." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

  const currentRole = await getCurrentUserRole(supabase, ctx.organizationId, ctx.userId);
  if (!canManageTeam(currentRole)) {
    return { ok: false, message: "Only owners and admins can cancel invites." };
  }

  const { error } = await supabase
    .from("team_invites")
    .update({ status: "cancelled" })
    .eq("id", inviteId)
    .eq("organization_id", ctx.organizationId)
    .eq("status", "pending");

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/settings/team");
  return { ok: true, message: "Invite cancelled." };
}

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/org-cookie";

export type AcceptInviteResult = {
  ok: boolean;
  message: string;
  organizationName?: string;
};

type AcceptInviteRow = {
  ok: boolean;
  reason: string | null;
  organization_id: string | null;
  organization_name: string | null;
  role: string | null;
  invited_email: string | null;
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

  // The whole accept — validate (pending, unexpired, email matches the verified
  // session), create the membership with the role AS STORED on the invite, and
  // mark the invite accepted — happens atomically inside the
  // accept_team_invite() SECURITY DEFINER RPC, under a row lock on the invite.
  // The invitee isn't a member yet, so they can't read/write team_invites under
  // RLS; the RPC is the only authorized path, and it never trusts a
  // caller-supplied role.
  const { data: rows, error } = await supabase.rpc("accept_team_invite", { p_token: token });

  if (error) {
    console.error("[team] accept_team_invite RPC failed:", error.message);
    return { ok: false, message: "Couldn't accept this invite. Please try again." };
  }

  const result = (Array.isArray(rows) ? rows[0] : rows) as AcceptInviteRow | null;

  if (!result?.ok) {
    switch (result?.reason) {
      case "expired":
        return { ok: false, message: "This invite has expired. Ask your team admin to send a new one." };
      case "email_mismatch":
        return {
          ok: false,
          message: `This invite was sent to ${result.invited_email ?? "a different address"}. Please sign in with that email address.`,
        };
      case "invalid_role":
        return { ok: false, message: "This invite has an invalid role. Ask your team admin to send a new one." };
      case "already_member":
        return { ok: false, message: "You're already a member of this organization." };
      default:
        // "already_accepted" / "already_cancelled" / "already_declined"
        if (result?.reason?.startsWith("already_")) {
          return { ok: false, message: `This invite has already been ${result.reason.slice("already_".length)}.` };
        }
        return { ok: false, message: "This invite link is invalid." };
    }
  }

  // Decision 3.3 — auto-switch to the newly-joined org so the dashboard reflects
  // what they just accepted. Cookie write failures aren't fatal (getOrgContext
  // falls back to the oldest membership).
  try {
    const cookieStore = await cookies();
    cookieStore.set({
      name: ACTIVE_ORG_COOKIE,
      value: result.organization_id!,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/dashboard/settings/team");
  revalidatePath("/dashboard", "layout");

  return {
    ok: true,
    message: `Welcome to ${result.organization_name ?? "the team"}! You now have ${result.role} access.`,
    organizationName: result.organization_name ?? undefined,
  };
}

// Membership role enum and validator. Lives here (not in `actions.ts`) so
// non-action callers (e.g. `lib/team/accept-invite.ts`) can import it
// without dragging the whole "use server" module into their bundle.

export const VALID_INVITE_ROLES = ["admin", "dispatcher", "crew", "viewer"] as const;
export type TeamRole = (typeof VALID_INVITE_ROLES)[number];

export function isValidRole(role: string): role is TeamRole {
  return VALID_INVITE_ROLES.includes(role as TeamRole);
}

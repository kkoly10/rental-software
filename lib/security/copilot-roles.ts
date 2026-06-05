/**
 * Copilot role allow-lists. Kept in a dependency-free module (no `next/headers`,
 * no Supabase) so the gates can be unit-tested in isolation and imported by both
 * server routes and tests.
 */

export type CopilotRole = "owner" | "admin" | "dispatcher" | "crew" | "viewer";

// Who may read operational awareness (chat + daily briefing): roles that run
// day-to-day operations. Dispatchers record payments / send replies / run
// deliveries, so they get the same financial-aware roundup owners/admins see.
// Crew and viewer are excluded — they have no need for revenue/balance figures.
export const COPILOT_CHAT_ROLES: readonly CopilotRole[] = ["owner", "admin", "dispatcher"];

// Who may take Copilot actions (and read the website-content values that feed
// the content-edit action previews). Actions mutate org-wide settings and
// records, so they stay restricted to owners and admins.
export const COPILOT_ACTION_ROLES: readonly CopilotRole[] = ["owner", "admin"];

export function copilotRoleAllowed(
  role: CopilotRole,
  allowed: readonly CopilotRole[]
): boolean {
  return allowed.includes(role);
}

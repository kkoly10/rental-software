/**
 * Name of the HttpOnly cookie that holds the user's currently-active org id.
 * Decision 3.1 — the org switcher writes this cookie and `getOrgContext`
 * honours it when the user has a matching active membership.
 *
 * Lives in its own non-"use server" module so it can be imported alongside
 * other constants without violating the "server files can only export async
 * functions" constraint in Next.js — putting it in `org-context.ts` (which
 * is `"use server"`) caused Next to treat the whole module as having no
 * exports during build.
 */
export const ACTIVE_ORG_COOKIE = "korent-active-org";

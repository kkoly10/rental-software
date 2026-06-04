import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";

/**
 * Lightweight endpoint the DashboardShell hits on mount so it can decide
 * whether to surface the operator-facing demo-mode banner. We don't trust
 * the client to know whether Supabase is wired up — `hasSupabaseEnv()`
 * reads server-side env vars that aren't shipped to the browser.
 *
 * Decision 3.5 — the operator-facing demo banner is the honest signal that
 * every server action returning `{ ok: true }` early is a no-op. Surfacing
 * the state once per session is less invasive than disabling every button.
 */
export async function GET() {
  return NextResponse.json(
    { demoMode: !hasSupabaseEnv() },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}

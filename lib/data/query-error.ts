import { logAppError } from "@/lib/observability/server";

/**
 * Phase-2 QA follow-up — the vertical walkthroughs caught data
 * loaders rendering empty states ("0 orders in your pipeline",
 * "No routes exist for this date yet") when the underlying Supabase
 * query had actually FAILED. `const { data } = await supabase…`
 * discards the error, so the UI can't tell "no rows" from "query
 * broke", and the only trace was a console.error lost in stdout.
 *
 * Route every data-loader error through here instead: it lands in
 * app_error_logs + Sentry where a recurrence is visible, and the
 * caller can branch to a "couldn't load, refresh" UI state rather
 * than a misleading empty state.
 *
 * Fire-and-forget — never throws, never blocks the render.
 */
export function reportQueryError(
  source: string,
  error: { message?: string; code?: string } | null | undefined,
  context?: Record<string, unknown>,
): void {
  if (!error) return;
  console.error(`[${source}] query failed:`, error.message ?? error);
  void logAppError({
    source,
    message: error.message ?? "Supabase query failed",
    context: { ...context, code: error.code ?? null },
  }).catch(() => {
    /* observability must never break the page */
  });
}

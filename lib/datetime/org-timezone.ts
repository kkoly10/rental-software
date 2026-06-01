import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Read the org's IANA event_timezone, cached per request.
 *
 * Most dashboard data-layer accessors render dates and times for the
 * operator. Operators are typically in the same TZ as their business,
 * so the org's configured event_timezone is the right rendering tz.
 * react `cache()` deduplicates the lookup so a page that calls 5
 * data accessors triggers exactly one extra DB query, not five.
 *
 * Falls back to "UTC" when:
 *  - Supabase env isn't configured (demo / local without DB).
 *  - The query itself errors (a misconfigured event_timezone
 *    shouldn't crash the dashboard — rendering in UTC is a safe
 *    default).
 */
export const getOrgEventTimezone = cache(async (organizationId: string): Promise<string> => {
  if (!hasSupabaseEnv()) return "UTC";
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("organizations")
      .select("event_timezone")
      .eq("id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    return data?.event_timezone ?? "UTC";
  } catch {
    return "UTC";
  }
});

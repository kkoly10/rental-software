import crypto from "node:crypto";

export function createTrackingToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashTrackingToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a tracking token for a route stop and persists the hash.
 * Called when driver marks stop as en_route. TTL defaults to 24 hours.
 */
export async function issueTrackingToken(options: {
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>;
  stopId: string;
  ttlHours?: number;
}): Promise<string> {
  const { supabase, stopId, ttlHours = 24 } = options;
  const token = createTrackingToken();
  const tokenHash = hashTrackingToken(token);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  // Only issue tokens for stops the driver is actively on the way to —
  // tracking links on completed / skipped / pending stops are
  // confusing for the customer (a "pending" link wakes the map view
  // before the driver has actually left). Gate via the UPDATE's
  // WHERE clause so a concurrent status change can't slip a token
  // onto a stop that's no longer en_route.
  const { data: updated, error } = await supabase
    .from("route_stops")
    .update({ tracking_token_hash: tokenHash, tracking_token_expires_at: expiresAt })
    .eq("id", stopId)
    .eq("stop_status", "en_route")
    .select("id");

  if (error) throw new Error(`Failed to issue tracking token: ${error.message}`);
  if (!updated || updated.length === 0) {
    throw new Error("Stop is not en_route; cannot issue tracking token.");
  }
  return token;
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/env";
import { hashTrackingToken } from "@/lib/tracking/access-token";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 20) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Not available in demo mode." }, { status: 503 });
  }

  const clientIp =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
    "unknown";
  try {
    const limit = await enforceRateLimit({
      scope: "tracking:lookup",
      actor: clientIp,
      limit: 30,
      windowSeconds: 300,
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  const tokenHash = hashTrackingToken(token);
  // Use admin client — this is a public unauthenticated route; authorization
  // is provided by the hashed token lookup, not a user session.
  const supabase = createSupabaseAdminClient();

  const { data: stop } = await supabase
    .from("route_stops")
    .select(`
      id,
      stop_status,
      tracking_token_expires_at,
      route_id,
      orders!inner (
        order_number,
        customers!inner ( first_name )
      )
    `)
    .eq("tracking_token_hash", tokenHash)
    .maybeSingle();

  if (!stop) {
    // Track failed lookups (expired / revoked / brute-forced tokens)
    // so we can spot scanning attempts and tighten rate-limits.
    {
      const { logAppEvent } = await import("@/lib/observability/server");
      await logAppEvent({
        source: "tracking.access",
        action: "lookup_miss",
        status: "warning",
        route: "/api/tracking/[token]",
        metadata: { token_hash_prefix: tokenHash.slice(0, 8) },
      });
    }
    return NextResponse.json({ error: "Tracking link not found." }, { status: 404 });
  }

  if (
    stop.tracking_token_expires_at &&
    new Date(stop.tracking_token_expires_at) < new Date()
  ) {
    return NextResponse.json({ error: "Tracking link has expired." }, { status: 410 });
  }

  const order = stop.orders as unknown as {
    order_number: string;
    customers: { first_name: string };
  };

  // Audit-log successful tracking access. Anon callers don't carry a
  // user_id; we record the route + stop so an operator can later see
  // who was looked up when investigating a leaked link.
  {
    const { logAppEvent } = await import("@/lib/observability/server");
    await logAppEvent({
      source: "tracking.access",
      action: "lookup_hit",
      status: "info",
      route: "/api/tracking/[token]",
      metadata: {
        stop_id: stop.id,
        route_id: stop.route_id,
        order_number: order.order_number,
        stop_status: stop.stop_status,
      },
    });
  }

  return NextResponse.json({
    routeId: stop.route_id,
    stopStatus: stop.stop_status,
    orderNumber: order.order_number,
    customerFirstName: order.customers.first_name,
    isLive: stop.stop_status === "en_route" || stop.stop_status === "in_progress",
  });
}

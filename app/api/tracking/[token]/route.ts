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

  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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
    // Allow through if rate limiting unavailable
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

  return NextResponse.json({
    stopStatus: stop.stop_status,
    orderNumber: order.order_number,
    customerFirstName: order.customers.first_name,
    isLive: stop.stop_status === "en_route" || stop.stop_status === "in_progress",
  });
}

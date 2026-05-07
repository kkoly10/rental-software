import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hashTrackingToken } from "@/lib/tracking/access-token";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 20) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  const tokenHash = hashTrackingToken(token);
  const supabase = await createSupabaseServerClient();

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
    routeId: stop.route_id,
    stopStatus: stop.stop_status,
    orderNumber: order.order_number,
    customerFirstName: order.customers.first_name,
    isLive: stop.stop_status === "en_route" || stop.stop_status === "in_progress",
  });
}

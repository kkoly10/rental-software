import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fire the customer "delivery en route" SMS that the dashboard-side
 * `updateStopStatus` and the new Smart Delivery Mode
 * `dispatchOrderDelivery` both need when a stop transitions to
 * `en_route`. Extracted so both paths get identical behavior — without
 * this helper, the new one-click dispatch button would silently skip
 * the customer notification that the legacy path sends.
 *
 * Never throws — failures are logged to stderr. The customer-facing
 * tracking link issuance and the SMS send are both best-effort; the
 * dispatch action itself has already succeeded by the time we run.
 */
export async function fireEnRouteSms(
  supabase: SupabaseClient,
  organizationId: string,
  stopId: string,
): Promise<void> {
  try {
    const { issueTrackingToken } = await import("@/lib/tracking/access-token");
    const { getSiteUrl } = await import("@/lib/site-url");
    const { sendSmsNotification } = await import("@/lib/sms/send-notification");

    const token = await issueTrackingToken({ supabase, stopId });
    const siteUrl = await getSiteUrl();
    const trackingUrl = `${siteUrl}/track/${token}`;

    const { data: stopWithOrder } = await supabase
      .from("route_stops")
      .select(
        "orders!inner(id, order_number, customer_id, customers!inner(phone, first_name, sms_opt_in))",
      )
      .eq("id", stopId)
      .maybeSingle();

    if (!stopWithOrder) return;

    const order = (stopWithOrder as unknown as {
      orders: {
        id: string;
        order_number: string;
        customer_id: string;
        customers: { phone: string; first_name: string; sms_opt_in: boolean };
      };
    }).orders;
    const customer = order?.customers;
    if (!customer?.phone || !customer?.sms_opt_in) return;

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    await sendSmsNotification(
      "deliveryEnRoute",
      customer.phone,
      {
        orderNumber: order.order_number,
        eta: "shortly",
        businessName: org?.name ?? "Your delivery",
        trackingUrl,
      },
      organizationId,
      { orderId: order.id, customerId: order.customer_id },
    );
  } catch (err) {
    console.error("[routes.send-en-route-sms] failed:", err);
  }
}

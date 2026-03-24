import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const fallbackOrderDetail = {
  id: "ord_1001",
  orderNumber: "1001",
  status: "Confirmed",
  customerName: "Ashley Johnson",
  customerEmail: "ashley@example.com",
  customerPhone: "(540) 555-0102",
  items: ["Castle Bouncer", "Generator Add-on"],
  deliveryLabel: "May 24, 2026 · 9:00 AM · Stafford, VA 22554",
  documents: ["Rental agreement signed", "Safety waiver signed"],
  subtotal: "$225",
  deliveryFee: "$20",
  depositPaid: "$75",
  balanceDue: "$170",
};

export async function getOrderDetail(orderId: string) {
  if (!hasSupabaseEnv()) {
    return {
      ...fallbackOrderDetail,
      id: orderId,
    };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, order_status, total_amount, delivery_fee_amount, deposit_due_amount, balance_due_amount"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    return {
      ...fallbackOrderDetail,
      id: orderId,
    };
  }

  return {
    id: data.id,
    orderNumber: data.order_number ?? "Order",
    status: data.order_status ?? "Inquiry",
    customerName: "Customer",
    customerEmail: "",
    customerPhone: "",
    items: ["Rental booking"],
    deliveryLabel: "Delivery details coming from live order data next",
    documents: ["Documents pending"],
    subtotal: typeof data.total_amount === "number" ? `$${data.total_amount}` : "$0",
    deliveryFee:
      typeof data.delivery_fee_amount === "number" ? `$${data.delivery_fee_amount}` : "$0",
    depositPaid:
      typeof data.deposit_due_amount === "number" ? `$${data.deposit_due_amount}` : "$0",
    balanceDue:
      typeof data.balance_due_amount === "number" ? `$${data.balance_due_amount}` : "$0",
  };
}

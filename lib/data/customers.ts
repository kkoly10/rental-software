import { mockOrders } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerSummary } from "@/lib/types";

const fallbackCustomers: CustomerSummary[] = mockOrders.map((order) => ({
  id: order.id,
  name: order.customer,
  email: "customer@example.com",
  phone: "(540) 555-0100",
  latestBooking: order.item,
  latestDate: order.date,
}));

export async function getCustomers(): Promise<CustomerSummary[]> {
  if (!hasSupabaseEnv()) {
    return fallbackCustomers;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, phone, created_at, orders(order_number, event_date, order_status)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    return fallbackCustomers;
  }

  return data.map((customer) => {
    const orders = ((customer as Record<string, unknown>).orders as { order_number: string; event_date: string; order_status: string }[] | null) ?? [];
    const latest = orders[0];
    return {
      id: customer.id,
      name: `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      latestBooking: latest?.order_number ?? "No bookings",
      latestDate: latest?.event_date
        ? new Date(latest.event_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "N/A",
    };
  });
}

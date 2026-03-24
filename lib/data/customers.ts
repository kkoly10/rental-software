import { mockOrders } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCustomers() {
  if (!hasSupabaseEnv()) {
    return mockOrders.map((order) => ({
      id: order.id,
      name: order.customer,
      email: "customer@example.com",
      phone: "(540) 555-0100",
      latestBooking: order.item,
      latestDate: order.date,
    }));
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, phone, created_at")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return mockOrders.map((order) => ({
      id: order.id,
      name: order.customer,
      email: "customer@example.com",
      phone: "(540) 555-0100",
      latestBooking: order.item,
      latestDate: order.date,
    }));
  }

  return data.map((customer) => ({
    id: customer.id,
    name: `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    latestBooking: "Rental booking",
    latestDate: "TBD",
  }));
}

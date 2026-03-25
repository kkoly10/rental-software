import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import type { CustomerDetail } from "@/lib/types";

const fallbackCustomerDetail: CustomerDetail = {
  id: "cust_1001",
  name: "Ashley Johnson",
  email: "ashley@example.com",
  phone: "(540) 555-0102",
  notes: "Repeat customer. Prefers early setup window and text reminders.",
  addressLabel: "123 Oak Lane, Stafford, VA 22554",
  orders: [
    "Johnson Birthday Setup · Confirmed · $245",
    "Neighborhood Cookout · Completed · $190",
    "Church Family Day Referral · Inquiry",
  ],
};

export async function getCustomerDetail(
  customerId: string
): Promise<CustomerDetail> {
  if (!hasSupabaseEnv()) {
    return { ...fallbackCustomerDetail, id: customerId };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ...fallbackCustomerDetail, id: customerId };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select(`
      id, first_name, last_name, email, phone, notes,
      customer_addresses(line1, city, state, postal_code, is_default_delivery),
      orders(id, order_number, order_status, total_amount, event_date)
    `)
    .eq("id", customerId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (error || !data) {
    return { ...fallbackCustomerDetail, id: customerId };
  }

  const addresses =
    ((data as Record<string, unknown>).customer_addresses as
      | {
          line1: string;
          city: string;
          state: string;
          postal_code: string;
          is_default_delivery?: boolean;
        }[]
      | null) ?? [];

  const orders =
    ((data as Record<string, unknown>).orders as
      | {
          id: string;
          order_number: string;
          order_status: string;
          total_amount: number;
          event_date: string;
        }[]
      | null) ?? [];

  const defaultAddr =
    addresses.find((a) => a.is_default_delivery) ?? addresses[0];

  return {
    id: data.id,
    name:
      `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || "Customer",
    email: data.email ?? "",
    phone: data.phone ?? "",
    notes: data.notes ?? "",
    addressLabel: defaultAddr
      ? `${defaultAddr.line1}, ${defaultAddr.city}, ${defaultAddr.state} ${defaultAddr.postal_code}`
      : "No saved address",
    orders:
      orders.length > 0
        ? orders.map((o) => {
            const status = (o.order_status ?? "inquiry")
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c: string) => c.toUpperCase());
            return `${o.order_number} · ${status} · $${o.total_amount ?? 0}`;
          })
        : ["No orders yet"],
  };
}

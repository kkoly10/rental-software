import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const fallbackCustomerDetail = {
  id: "cust_1001",
  name: "Ashley Johnson",
  email: "ashley@example.com",
  phone: "(540) 555-0102",
  notes: "Repeat customer. Prefers early setup window and text reminders.",
  addressLabel: "Stafford, VA 22554 · Backyard birthday setup",
  orders: [
    "Johnson Birthday Setup · Confirmed · $245",
    "Neighborhood Cookout · Completed · $190",
    "Church Family Day Referral · Inquiry",
  ],
};

export async function getCustomerDetail(customerId: string) {
  if (!hasSupabaseEnv()) {
    return {
      ...fallbackCustomerDetail,
      id: customerId,
    };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, phone, notes")
    .eq("id", customerId)
    .maybeSingle();

  if (error || !data) {
    return {
      ...fallbackCustomerDetail,
      id: customerId,
    };
  }

  return {
    id: data.id,
    name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || "Customer",
    email: data.email ?? "",
    phone: data.phone ?? "",
    notes: data.notes ?? "",
    addressLabel: "Saved addresses coming from live customer data next",
    orders: ["Order history coming from live data next"],
  };
}

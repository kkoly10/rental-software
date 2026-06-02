import { notFound } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import type { CustomerDetail } from "@/lib/types";

const fallbackCustomerDetail: CustomerDetail = {
  id: "cust_1001",
  name: "Ashley Johnson",
  firstName: "Ashley",
  lastName: "Johnson",
  email: "ashley@example.com",
  phone: "(540) 555-0102",
  preferredLocale: "en",
  notes: "Repeat customer. Prefers early setup window and text reminders.",
  addressLabel: "123 Oak Lane · Stafford, VA 22554",
  addressLine1: "123 Oak Lane",
  addressLine2: "",
  addressCity: "Stafford",
  addressState: "VA",
  addressZip: "22554",
  orders: [
    { id: "ord_1001", label: "Johnson Birthday Setup · Confirmed · $245.00" },
    { id: "ord_1002", label: "Neighborhood Cookout · Completed · $190.00" },
    { id: "ord_1003", label: "Church Family Day Referral · Inquiry · $0.00" },
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
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select(`
      id, first_name, last_name, email, phone, notes, preferred_locale,
      customer_addresses(line1, line2, city, state, postal_code, is_default_delivery),
      orders(id, order_number, order_status, total_amount, event_date, deleted_at)
    `)
    .eq("id", customerId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const addresses =
    ((data as Record<string, unknown>).customer_addresses as
      | {
          line1: string;
          line2: string | null;
          city: string;
          state: string;
          postal_code: string;
          is_default_delivery?: boolean;
        }[]
      | null) ?? [];

  const orders =
    (((data as Record<string, unknown>).orders as
      | {
          id: string;
          order_number: string;
          order_status: string;
          total_amount: number;
          event_date: string;
          deleted_at: string | null;
        }[]
      | null) ?? []).filter((o) => !o.deleted_at);

  const defaultAddr =
    addresses.find((a) => a.is_default_delivery) ?? addresses[0];

  return {
    id: data.id,
    name:
      `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || "Customer",
    firstName: data.first_name ?? "",
    lastName: data.last_name ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    preferredLocale: (data as { preferred_locale?: string | null }).preferred_locale ?? "en",
    notes: data.notes ?? "",
    addressLabel: defaultAddr
      ? [
          defaultAddr.line2 ? `${defaultAddr.line1}, ${defaultAddr.line2}` : defaultAddr.line1,
          `${defaultAddr.city}, ${defaultAddr.state} ${defaultAddr.postal_code}`,
        ].join(" · ")
      : "No saved address",
    addressLine1: defaultAddr?.line1 ?? "",
    addressLine2: defaultAddr?.line2 ?? "",
    addressCity: defaultAddr?.city ?? "",
    addressState: defaultAddr?.state ?? "",
    addressZip: defaultAddr?.postal_code ?? "",
    orders: [...orders]
      .sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? ""))
      .map((o) => {
        const status = (o.order_status ?? "inquiry")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
        return {
          id: o.id,
          label: `${o.order_number} · ${status} · $${Number(o.total_amount ?? 0).toFixed(2)}`,
        };
      }),
  };
}

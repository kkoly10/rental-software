import { mockOrders } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { paginateItems, type PaginatedResult, normalizeQuery } from "@/lib/listing/pagination";
import type { CustomerSummary } from "@/lib/types";

const fallbackCustomers: CustomerSummary[] = mockOrders.map((order) => ({
  id: order.id,
  name: order.customer,
  email: "customer@example.com",
  phone: "(540) 555-0100",
  latestBooking: order.item,
  latestDate: order.date,
}));

function matchesCustomerQuery(customer: CustomerSummary, query: string) {
  if (!query) return true;

  const haystack = [
    customer.name,
    customer.email,
    customer.phone,
    customer.latestBooking,
    customer.latestDate,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export async function getCustomersPage(options?: {
  page?: string | number | null;
  query?: string | null;
  pageSize?: number;
}): Promise<PaginatedResult<CustomerSummary>> {
  const query = normalizeQuery(options?.query);

  if (!hasSupabaseEnv()) {
    const filtered = fallbackCustomers.filter((customer) =>
      matchesCustomerQuery(customer, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    const filtered = fallbackCustomers.filter((customer) =>
      matchesCustomerQuery(customer, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, first_name, last_name, email, phone, created_at, orders(order_number, event_date, order_status)"
    )
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !data || data.length === 0) {
    const filtered = fallbackCustomers.filter((customer) =>
      matchesCustomerQuery(customer, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const mapped: CustomerSummary[] = data.map((customer) => {
    const orders =
      ((customer as Record<string, unknown>).orders as
        | { order_number?: string | null; event_date?: string | null; order_status?: string | null }[]
        | null) ?? [];
    const latest = orders[0];

    return {
      id: customer.id,
      name:
        `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
        "Customer",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      latestBooking: latest?.order_number ?? "No bookings",
      latestDate: latest?.event_date
        ? new Date(latest.event_date + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "N/A",
    };
  });

  const filtered = mapped.filter((customer) =>
    matchesCustomerQuery(customer, query)
  );

  return paginateItems(filtered, {
    page: options?.page,
    pageSize: options?.pageSize ?? 20,
    query,
  });
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  const result = await getCustomersPage();
  return result.items;
}
import { mockOrders } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import {
  paginateItems,
  type PaginatedResult,
  normalizeQuery,
  normalizePage,
} from "@/lib/listing/pagination";
import { escapeIlike } from "@/lib/listing/ilike-escape";
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

type CustomerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

function mapCustomerRow(
  customer: CustomerRow,
  latest?: { order_number?: string | null; event_date?: string | null }
): CustomerSummary {
  return {
    id: customer.id,
    name:
      `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
      "Customer",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    latestBooking: latest?.order_number ?? "No bookings",
    latestDate: latest?.event_date
      ? new Date(latest.event_date + "T00:00:00Z").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : "N/A",
  };
}

export async function getCustomersPage(options?: {
  page?: string | number | null;
  query?: string | null;
  pageSize?: number;
}): Promise<PaginatedResult<CustomerSummary>> {
  const query = normalizeQuery(options?.query);
  const pageSize = options?.pageSize ?? 20;

  if (!hasSupabaseEnv()) {
    const filtered = fallbackCustomers.filter((customer) =>
      matchesCustomerQuery(customer, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize,
      query,
    });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return paginateItems([], { page: options?.page, pageSize, query });
  }

  const supabase = await createSupabaseServerClient();
  const currentPage = normalizePage(options?.page);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize - 1;

  // Push pagination + count to the database. The query searches across
  // first_name, last_name, email, phone; embedded orders are pulled per row
  // (page-sized, not a 500-row blob) so the latest-booking column still
  // renders without needing JS to filter the whole table.
  let baseQuery = supabase
    .from("customers")
    .select(
      "id, first_name, last_name, email, phone, created_at, orders(order_number, event_date, order_status)",
      { count: "exact" }
    )
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);

  if (query) {
    const safe = escapeIlike(query);
    const pattern = `%${safe}%`;
    baseQuery = baseQuery.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
    );
  }

  const { data, error, count } = await baseQuery
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    console.error("[customers] Query failed:", error.message);
    return paginateItems([], { page: options?.page, pageSize, query });
  }

  const mapped: CustomerSummary[] = (data ?? []).map((customer) => {
    const orders = [
      ...(((customer as Record<string, unknown>).orders as
        | { order_number?: string | null; event_date?: string | null; order_status?: string | null }[]
        | null) ?? []),
    ];
    orders.sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? ""));
    return mapCustomerRow(customer as CustomerRow, orders[0]);
  });

  const totalItems = count ?? mapped.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    items: mapped,
    page: Math.min(currentPage, totalPages),
    pageSize,
    totalItems,
    totalPages,
    query,
  };
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  const result = await getCustomersPage();
  return result.items;
}

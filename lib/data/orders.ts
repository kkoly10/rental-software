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
import type { OrderSummary } from "@/lib/types";

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(status: string): OrderSummary["tone"] {
  if (
    status === "confirmed" ||
    status === "completed" ||
    status === "delivered"
  ) {
    return "success";
  }
  if (status === "awaiting_deposit" || status === "quote_sent") {
    return "warning";
  }
  if (status === "cancelled" || status === "refunded") {
    return "danger";
  }
  return "default";
}

type OrderRow = {
  id: string;
  order_number: string | null;
  order_status: string | null;
  event_date: string | null;
  total_amount: number | string | null;
};

function mapOrderRow(order: OrderRow): OrderSummary {
  const customer = (order as Record<string, unknown>).customers as
    | { first_name?: string | null; last_name?: string | null; deleted_at?: string | null }
    | null;
  const items =
    ((order as Record<string, unknown>).order_items as
      | { item_name_snapshot?: string | null }[]
      | null) ?? [];
  const address = (order as Record<string, unknown>).customer_addresses as
    | { postal_code?: string | null }
    | null;
  const status = order.order_status ?? "inquiry";
  const customerLabel =
    customer && !customer.deleted_at
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : "";
  return {
    id: order.id,
    customer: customerLabel || (order.order_number ?? "Order"),
    item:
      items.length > 0
        ? items.map((i) => i.item_name_snapshot).filter(Boolean).join(", ")
        : "Rental booking",
    date: order.event_date
      ? new Date(order.event_date + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : "TBD",
    total: `$${Number(order.total_amount ?? 0).toFixed(2)}`,
    status: formatStatus(status),
    tone: statusTone(status),
    eventDateRaw: order.event_date ?? undefined,
    postalCode: address?.postal_code ?? undefined,
  };
}

function matchesOrderQuery(order: OrderSummary, query: string) {
  if (!query) return true;

  const haystack = [
    order.customer,
    order.item,
    order.date,
    order.total,
    order.status,
    order.id,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export async function getOrdersPage(options?: {
  page?: string | number | null;
  query?: string | null;
  pageSize?: number;
}): Promise<PaginatedResult<OrderSummary>> {
  const query = normalizeQuery(options?.query);

  if (!hasSupabaseEnv()) {
    const filtered = mockOrders.filter((order) =>
      matchesOrderQuery(order, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return paginateItems([], { page: options?.page, pageSize: options?.pageSize ?? 20, query });
  }

  const supabase = await createSupabaseServerClient();
  const selectFields =
    "id, order_number, order_status, event_date, total_amount, customers(first_name, last_name, deleted_at), order_items(item_name_snapshot), customer_addresses!delivery_address_id(postal_code)";
  const pageSize = options?.pageSize ?? 20;

  // No-query path: paginate + count at the DB so every order is reachable and
  // totals are accurate (no silent 500-row JS truncation).
  if (!query) {
    const currentPage = normalizePage(options?.page);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize - 1;
    const { data, error, count } = await supabase
      .from("orders")
      .select(selectFields, { count: "exact" })
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(start, end);

    if (error) {
      console.error("[orders] Query failed:", error.message);
      return paginateItems([], { page: options?.page, pageSize, query });
    }

    const mappedPage = (data ?? []).map(mapOrderRow);
    const totalItems = count ?? mappedPage.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return {
      items: mappedPage,
      page: Math.min(currentPage, totalPages),
      pageSize,
      totalItems,
      totalPages,
      query: "",
    };
  }

  // Search path: pushed down to Postgres in two phases instead of a
  // 5000-row JS filter. Previously a search past the 5000-row window
  // silently missed older orders.
  //
  // Phase 1: collect candidate order_ids from three index-friendly
  //   ilike lookups (orders.order_number, customers by name/email,
  //   order_items.item_name_snapshot). Each runs in parallel.
  // Phase 2: fetch the paginated page from orders.in(union).
  const like = `%${escapeIlike(query)}%`;
  const orgFilter = ctx.organizationId;

  const [orderNumberRes, customerRes, itemRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id")
      .eq("organization_id", orgFilter)
      .is("deleted_at", null)
      .ilike("order_number", like)
      .limit(5000),
    supabase
      .from("customers")
      .select("id")
      .eq("organization_id", orgFilter)
      .is("deleted_at", null)
      .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`)
      .limit(2000),
    supabase
      .from("order_items")
      .select("order_id, orders!inner(organization_id)")
      .eq("orders.organization_id", orgFilter)
      .ilike("item_name_snapshot", like)
      .limit(5000),
  ]);

  const candidateOrderIds = new Set<string>();
  for (const r of orderNumberRes.data ?? []) candidateOrderIds.add(r.id);
  for (const r of itemRes.data ?? []) {
    if (r.order_id) candidateOrderIds.add(r.order_id);
  }

  // Customer hits → order_ids via a single follow-up query.
  const customerIds = (customerRes.data ?? []).map((r) => r.id);
  if (customerIds.length > 0) {
    const { data: customerOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("organization_id", orgFilter)
      .is("deleted_at", null)
      .in("customer_id", customerIds)
      .limit(5000);
    for (const r of customerOrders ?? []) candidateOrderIds.add(r.id);
  }

  if (candidateOrderIds.size === 0) {
    return paginateItems([], { page: options?.page, pageSize, query });
  }

  const currentPage = normalizePage(options?.page);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize - 1;

  const { data, error, count } = await supabase
    .from("orders")
    .select(selectFields, { count: "exact" })
    .eq("organization_id", orgFilter)
    .is("deleted_at", null)
    .in("id", Array.from(candidateOrderIds))
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    console.error("[orders] Search query failed:", error.message);
    return paginateItems([], { page: options?.page, pageSize, query });
  }

  const mapped = (data ?? []).map(mapOrderRow);
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

// Postgres ILIKE wildcards are `%` and `_`; backslash is the escape.
// A user typing "50%" should match "50%" literally, not "anything
// starting with 50". Same for underscores in product slugs.
function escapeIlike(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}

export async function getOrders(): Promise<OrderSummary[]> {
  const result = await getOrdersPage();
  return result.items;
}
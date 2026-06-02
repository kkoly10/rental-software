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
      ? new Date(order.event_date + "T12:00:00Z").toLocaleDateString("en-US", {
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

  // Search path. Push to Postgres in two steps so the OR can span the
  // related customers table:
  //   1. Resolve customer-name matches to a list of customer_id values
  //      (capped, since we have to inline them into the orders OR clause
  //       and PostgREST URLs have a ceiling).
  //   2. Filter orders by order_number ILIKE OR customer_id IN (...).
  // Embedded `items` snapshots are not searched at the DB level —
  // operators searching by item name are rare and that surface still has
  // the truncation telemetry from #177.
  const currentPage = normalizePage(options?.page);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize - 1;
  const safe = escapeIlike(query);
  const pattern = `%${safe}%`;

  // Step 1: customer-name → ids. Capped so the IN list stays short.
  const NAME_MATCH_CAP = 200;
  const { data: nameMatches, error: nameError } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)
    .limit(NAME_MATCH_CAP);

  if (nameError) {
    console.error("[orders] Customer-name lookup failed:", nameError.message);
    // Fall through with no customer ids; order-number search still works.
  }
  const matchedIds = (nameMatches ?? []).map((c) => c.id);

  // Step 2: orders by order_number OR customer_id IN (...).
  let orFilter = `order_number.ilike.${pattern}`;
  if (matchedIds.length > 0) {
    orFilter += `,customer_id.in.(${matchedIds.join(",")})`;
  }

  const { data, error, count } = await supabase
    .from("orders")
    .select(selectFields, { count: "exact" })
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .or(orFilter)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    console.error("[orders] Search query failed:", error.message);
    return paginateItems([], { page: options?.page, pageSize, query });
  }

  const mapped: OrderSummary[] = (data ?? []).map(mapOrderRow);
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

export async function getOrders(): Promise<OrderSummary[]> {
  const result = await getOrdersPage();
  return result.items;
}
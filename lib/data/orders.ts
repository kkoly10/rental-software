import { mockOrders } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getOrgFormatting } from "@/lib/i18n/org-formatting";
import { formatMoney } from "@/lib/i18n/format-helpers";
import {
  paginateItems,
  type PaginatedResult,
  normalizeQuery,
  normalizePage,
} from "@/lib/listing/pagination";
import { escapeIlike } from "@/lib/listing/ilike-escape";
import { reportQueryError } from "@/lib/data/query-error";
import type { OrderSummary } from "@/lib/types";

// Maps each Orders-tab filter chip to the raw order_status values it covers.
// The ~10 real statuses collapse into the 4 operator-facing groups the
// dashboard shows; "all" is the unfiltered set.
export const ORDER_STATUS_FILTERS = {
  inquiry: ["inquiry", "quote_sent"],
  confirmed: ["confirmed", "awaiting_deposit", "scheduled"],
  out_for_delivery: ["out_for_delivery", "delivered"],
  completed: ["completed"],
} as const;
export type OrderStatusFilter = keyof typeof ORDER_STATUS_FILTERS;

function resolveStatusFilter(status?: string | null): readonly string[] | null {
  if (status && status in ORDER_STATUS_FILTERS) {
    return ORDER_STATUS_FILTERS[status as OrderStatusFilter];
  }
  return null;
}

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

function mapOrderRow(order: OrderRow, money: (n: number) => string, locale: string): OrderSummary {
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
      ? new Date(order.event_date + "T12:00:00Z").toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : "TBD",
    total: money(Number(order.total_amount ?? 0)),
    status: formatStatus(status),
    tone: statusTone(status),
    eventDateRaw: order.event_date ?? undefined,
    // True when no event_date is set; orders flagged this way are
    // invisible to the calendar and route board until a date is added.
    // Surfaced on the orders list and detail page.
    missingEventDate: !order.event_date,
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
  status?: string | null;
}): Promise<PaginatedResult<OrderSummary>> {
  const query = normalizeQuery(options?.query);
  const statusFilter = resolveStatusFilter(options?.status);

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

  const { currency, locale } = await getOrgFormatting();
  const money = (n: number) => formatMoney(n, currency, locale);

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
    let listQuery = supabase
      .from("orders")
      .select(selectFields, { count: "exact" })
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null);
    if (statusFilter) {
      listQuery = listQuery.in("order_status", [...statusFilter]);
    }
    const { data, error, count } = await listQuery
      .order("created_at", { ascending: false })
      .range(start, end);

    if (error) {
      reportQueryError("data.orders.list", error, {
        status: options?.status ?? null,
      });
      return {
        ...paginateItems([], { page: options?.page, pageSize, query }),
        loadFailed: true,
      };
    }

    const mappedPage = (data ?? []).map((o) => mapOrderRow(o, money, locale));
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
    reportQueryError("data.orders.customer-name-lookup", nameError);
    // Fall through with no customer ids; order-number search still works.
  }
  const matchedIds = (nameMatches ?? []).map((c) => c.id);

  // Step 2: orders by order_number OR customer_id IN (...).
  let orFilter = `order_number.ilike.${pattern}`;
  if (matchedIds.length > 0) {
    orFilter += `,customer_id.in.(${matchedIds.join(",")})`;
  }

  let searchQuery = supabase
    .from("orders")
    .select(selectFields, { count: "exact" })
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .or(orFilter);
  if (statusFilter) {
    searchQuery = searchQuery.in("order_status", [...statusFilter]);
  }
  const { data, error, count } = await searchQuery
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    reportQueryError("data.orders.search", error, {
      status: options?.status ?? null,
    });
    return {
      ...paginateItems([], { page: options?.page, pageSize, query }),
      loadFailed: true,
    };
  }

  const mapped: OrderSummary[] = (data ?? []).map((o) => mapOrderRow(o, money, locale));
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

export type OrderStatusCounts = {
  all: number;
  inquiry: number;
  confirmed: number;
  out_for_delivery: number;
  completed: number;
};

/**
 * Per-chip counts for the Orders-tab filter row. One small COUNT(*) per group
 * (head-only, no rows), run in parallel. Returns zeros when not configured.
 */
export async function getOrderStatusCounts(): Promise<OrderStatusCounts> {
  const empty: OrderStatusCounts = { all: 0, inquiry: 0, confirmed: 0, out_for_delivery: 0, completed: 0 };
  if (!hasSupabaseEnv()) {
    return { ...empty, all: mockOrders.length };
  }
  const ctx = await getOrgContext();
  if (!ctx) return empty;

  const supabase = await createSupabaseServerClient();
  const base = () =>
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null);

  const [all, inquiry, confirmed, outForDelivery, completed] = await Promise.all([
    base(),
    base().in("order_status", [...ORDER_STATUS_FILTERS.inquiry]),
    base().in("order_status", [...ORDER_STATUS_FILTERS.confirmed]),
    base().in("order_status", [...ORDER_STATUS_FILTERS.out_for_delivery]),
    base().in("order_status", [...ORDER_STATUS_FILTERS.completed]),
  ]);

  return {
    all: all.count ?? 0,
    inquiry: inquiry.count ?? 0,
    confirmed: confirmed.count ?? 0,
    out_for_delivery: outForDelivery.count ?? 0,
    completed: completed.count ?? 0,
  };
}
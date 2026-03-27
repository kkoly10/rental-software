import { mockOrders } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { paginateItems, type PaginatedResult, normalizeQuery } from "@/lib/listing/pagination";
import type { OrderSummary } from "@/lib/types";

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(status: string): OrderSummary["tone"] {
  if (status === "confirmed" || status === "completed" || status === "delivered") {
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
    const filtered = mockOrders.filter((order) => matchesOrderQuery(order, query));
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    const filtered = mockOrders.filter((order) => matchesOrderQuery(order, query));
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, order_status, event_date, total_amount, customers(first_name, last_name, deleted_at), order_items(item_name_snapshot)"
    )
    .eq("organization_id", ctx.organizationId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !data || data.length === 0) {
    const filtered = mockOrders.filter((order) => matchesOrderQuery(order, query));
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const mapped: OrderSummary[] = data.map((order) => {
    const customer = (order as Record<string, unknown>).customers as
      | { first_name?: string | null; last_name?: string | null; deleted_at?: string | null }
      | null;
    const items =
      ((order as Record<string, unknown>).order_items as
        | { item_name_snapshot?: string | null }[]
        | null) ?? [];
    const status = order.order_status ?? "inquiry";

    const customerLabel =
      customer && !customer.deleted_at
        ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
        : "";

    return {
      id: order.id,
      customer: customerLabel || order.order_number ?? "Order",
      item:
        items.length > 0
          ? items.map((i) => i.item_name_snapshot).filter(Boolean).join(", ")
          : "Rental booking",
      date: order.event_date
        ? new Date(order.event_date + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "TBD",
      total:
        typeof order.total_amount === "number" ? `$${order.total_amount}` : "$0",
      status: formatStatus(status),
      tone: statusTone(status),
    };
  });

  const filtered = mapped.filter((order) => matchesOrderQuery(order, query));

  return paginateItems(filtered, {
    page: options?.page,
    pageSize: options?.pageSize ?? 20,
    query,
  });
}

export async function getOrders(): Promise<OrderSummary[]> {
  const result = await getOrdersPage();
  return result.items;
}
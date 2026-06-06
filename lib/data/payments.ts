import { mockOrders } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getOrgFormatting } from "@/lib/i18n/org-formatting";
import { formatMoney } from "@/lib/i18n/format-helpers";
import { formatDateInTimeZone } from "@/lib/datetime/event-time";
import { getOrgEventTimezone } from "@/lib/datetime/org-timezone";
import {
  paginateItems,
  type PaginatedResult,
  normalizeQuery,
  normalizePage,
} from "@/lib/listing/pagination";
import type { PaymentSummary } from "@/lib/types";

const fallbackPayments: PaymentSummary[] = mockOrders.map((order, index) => ({
  id: order.id,
  customer: order.customer,
  label:
    index === 0
      ? "$75 deposit paid"
      : index === 1
      ? "$0 unpaid"
      : "$170 balance due",
  item: order.item,
  date: order.date,
  type: index === 0 ? "deposit" : "balance",
  status: index === 0 ? "paid" : "pending",
}));

function matchesPaymentQuery(payment: PaymentSummary, query: string) {
  if (!query) return true;

  const haystack = [
    payment.customer,
    payment.label,
    payment.item,
    payment.date,
    payment.type,
    payment.status,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export async function getPaymentsPage(options?: {
  page?: string | number | null;
  query?: string | null;
  pageSize?: number;
}): Promise<PaginatedResult<PaymentSummary>> {
  const query = normalizeQuery(options?.query);

  if (!hasSupabaseEnv()) {
    const filtered = fallbackPayments.filter((payment) =>
      matchesPaymentQuery(payment, query)
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

  const tz = await getOrgEventTimezone(ctx.organizationId);
  const { currency, locale } = await getOrgFormatting();
  const money = (n: number) => formatMoney(n, currency, locale);
  const supabase = await createSupabaseServerClient();
  const selectFields =
    "id, payment_type, payment_status, amount, paid_at, order_id, orders!inner(organization_id, order_number, customers(first_name, last_name, deleted_at))";
  const pageSize = options?.pageSize ?? 20;

  // No-query path: paginate + count at the DB so totals are accurate and
  // payments past row 500 are reachable.
  if (!query) {
    const currentPage = normalizePage(options?.page);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize - 1;
    const { data, error, count } = await supabase
      .from("payments")
      .select(selectFields, { count: "exact" })
      .eq("orders.organization_id", ctx.organizationId)
      .is("orders.deleted_at", null)
      .order("paid_at", { ascending: false, nullsFirst: false })
      .range(start, end);

    if (error) {
      console.error("[payments] Query failed:", error.message);
      return paginateItems([], { page: options?.page, pageSize, query });
    }

    const mappedPage = (data ?? []).map((p) => mapPaymentRow(p, tz, money));
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

  // Search path: pull a larger window and JS-filter (query spans embedded
  // order/customer columns).
  const { data, error } = await supabase
    .from("payments")
    .select(selectFields)
    .eq("orders.organization_id", ctx.organizationId)
    .is("orders.deleted_at", null)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(5000);

  if (error) {
    console.error("[payments] Query failed:", error.message);
    return paginateItems([], { page: options?.page, pageSize, query });
  }

  const mapped: PaymentSummary[] = data.map((p) => mapPaymentRow(p, tz, money));
  const filtered = mapped.filter((payment) => matchesPaymentQuery(payment, query));

  return paginateItems(filtered, {
    page: options?.page,
    pageSize,
    query,
  });
}

type PaymentRow = {
  id: string;
  payment_type: string | null;
  payment_status: string | null;
  amount: number | string | null;
  paid_at: string | null;
  order_id: string | null;
};

function mapPaymentRow(payment: PaymentRow, tz: string, money: (n: number) => string): PaymentSummary {
  const order = (payment as Record<string, unknown>).orders as
    | {
        order_number?: string | null;
        customers?: {
          first_name?: string | null;
          last_name?: string | null;
          deleted_at?: string | null;
        } | null;
      }
    | null;
  const customer = order?.customers;
  const type = payment.payment_type ?? "payment";
  const status = payment.payment_status ?? "pending";
  const amount = typeof payment.amount === "number" ? payment.amount : 0;
  const customerLabel =
    customer && !customer.deleted_at
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : "";
  return {
    id: payment.id,
    customer: customerLabel || order?.order_number || "Order",
    label: `${money(amount)} ${type} ${status}`,
    item: order?.order_number ?? "N/A",
    date: payment.paid_at
      ? formatDateInTimeZone(payment.paid_at, tz, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Pending",
    type,
    status,
  };
}

export async function getPayments(): Promise<PaymentSummary[]> {
  const result = await getPaymentsPage();
  return result.items;
}
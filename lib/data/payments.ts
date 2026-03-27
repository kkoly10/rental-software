import { mockOrders } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import {
  paginateItems,
  type PaginatedResult,
  normalizeQuery,
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
    const filtered = fallbackPayments.filter((payment) =>
      matchesPaymentQuery(payment, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, payment_type, payment_status, amount, paid_at, order_id, orders!inner(organization_id, order_number, customers(first_name, last_name, deleted_at))"
    )
    .eq("orders.organization_id", ctx.organizationId)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error || !data || data.length === 0) {
    const filtered = fallbackPayments.filter((payment) =>
      matchesPaymentQuery(payment, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const mapped: PaymentSummary[] = data.map((payment) => {
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
      label: `$${amount} ${type} ${status}`,
      item: order?.order_number ?? "N/A",
      date: payment.paid_at
        ? new Date(payment.paid_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Pending",
      type,
      status,
    };
  });

  const filtered = mapped.filter((payment) =>
    matchesPaymentQuery(payment, query)
  );

  return paginateItems(filtered, {
    page: options?.page,
    pageSize: options?.pageSize ?? 20,
    query,
  });
}

export async function getPayments(): Promise<PaymentSummary[]> {
  const result = await getPaymentsPage();
  return result.items;
}
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import {
  paginateItems,
  type PaginatedResult,
  normalizeQuery,
} from "@/lib/listing/pagination";
import type { DocumentSummary } from "@/lib/types";

const fallbackDocuments: DocumentSummary[] = [
  {
    id: "doc_1",
    name: "Johnson Birthday Setup",
    agreement: "Rental agreement signed",
    waiver: "Safety waiver signed",
    orderId: "ord_1001",
  },
  {
    id: "doc_2",
    name: "Church Spring Event",
    agreement: "Agreement pending",
    waiver: "Waiver pending",
    orderId: "ord_1002",
  },
  {
    id: "doc_3",
    name: "School Field Day",
    agreement: "Rental agreement signed",
    waiver: "Safety waiver signed",
    orderId: "ord_1003",
  },
];

export async function getDocuments(): Promise<DocumentSummary[]> {
  if (!hasSupabaseEnv()) {
    return fallbackDocuments;
  }

  const ctx = await getOrgContext();
  if (!ctx) return fallbackDocuments;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, order_id, document_type, document_status, orders(order_number, customers(first_name, last_name, deleted_at))"
    )
    .eq("organization_id", ctx.organizationId)
    .order("id", { ascending: false })
    .limit(200);

  if (error || !data || data.length === 0) {
    return fallbackDocuments;
  }

  const byOrder = new Map<
    string,
    { name: string; agreement: string; waiver: string; orderId: string }
  >();

  for (const doc of data) {
    const order = (doc as Record<string, unknown>).orders as
      | {
          order_number?: string | null;
          customers?: {
            first_name?: string | null;
            last_name?: string | null;
            deleted_at?: string | null;
          } | null;
        }
      | null;

    const orderId = doc.order_id ?? "";
    const customer = order?.customers;
    const name =
      customer && !customer.deleted_at
        ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
        : order?.order_number ?? "Document";

    if (!byOrder.has(orderId)) {
      byOrder.set(orderId, {
        name,
        agreement: "No agreement",
        waiver: "No waiver",
        orderId,
      });
    }

    const entry = byOrder.get(orderId)!;
    const status = (doc.document_status ?? "pending").replace(/\b\w/g, (c: string) =>
      c.toUpperCase()
    );

    if (doc.document_type === "rental_agreement") {
      entry.agreement = `Rental Agreement: ${status}`;
    }
    if (doc.document_type === "safety_waiver") {
      entry.waiver = `Safety Waiver: ${status}`;
    }
  }

  return Array.from(byOrder.entries()).map(([, entry], i) => ({
    id: `doc_${i}`,
    ...entry,
  }));
}

export type DetailedDocument = {
  id: string;
  orderId: string;
  customerName: string;
  agreementId: string | null;
  agreementStatus: string;
  agreementLabel: string;
  waiverId: string | null;
  waiverStatus: string;
  waiverLabel: string;
};

const fallbackDetailed: DetailedDocument[] = [
  {
    id: "d1",
    orderId: "ord_1001",
    customerName: "Johnson Birthday Setup",
    agreementId: "doc_a1",
    agreementStatus: "signed",
    agreementLabel: "Agreement: Signed",
    waiverId: "doc_w1",
    waiverStatus: "signed",
    waiverLabel: "Waiver: Signed",
  },
  {
    id: "d2",
    orderId: "ord_1002",
    customerName: "Church Spring Event",
    agreementId: "doc_a2",
    agreementStatus: "pending",
    agreementLabel: "Agreement: Pending",
    waiverId: "doc_w2",
    waiverStatus: "pending",
    waiverLabel: "Waiver: Pending",
  },
];

function matchesDetailedDocumentQuery(doc: DetailedDocument, query: string) {
  if (!query) return true;

  const haystack = [
    doc.customerName,
    doc.orderId,
    doc.agreementLabel,
    doc.waiverLabel,
    doc.agreementStatus,
    doc.waiverStatus,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export async function getDocumentsDetailedPage(options?: {
  page?: string | number | null;
  query?: string | null;
  pageSize?: number;
}): Promise<PaginatedResult<DetailedDocument>> {
  const query = normalizeQuery(options?.query);

  if (!hasSupabaseEnv()) {
    const filtered = fallbackDetailed.filter((doc) =>
      matchesDetailedDocumentQuery(doc, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    const filtered = fallbackDetailed.filter((doc) =>
      matchesDetailedDocumentQuery(doc, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, order_id, document_type, document_status, orders(order_number, customers(first_name, last_name, deleted_at))"
    )
    .eq("organization_id", ctx.organizationId)
    .order("id", { ascending: false })
    .limit(500);

  if (error || !data || data.length === 0) {
    const filtered = fallbackDetailed.filter((doc) =>
      matchesDetailedDocumentQuery(doc, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const byOrder = new Map<string, DetailedDocument>();

  for (const doc of data) {
    const order = (doc as Record<string, unknown>).orders as
      | {
          order_number?: string | null;
          customers?: {
            first_name?: string | null;
            last_name?: string | null;
            deleted_at?: string | null;
          } | null;
        }
      | null;

    const orderId = doc.order_id ?? "";
    const customer = order?.customers;
    const name =
      customer && !customer.deleted_at
        ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
        : order?.order_number ?? "Document";

    if (!byOrder.has(orderId)) {
      byOrder.set(orderId, {
        id: orderId,
        orderId,
        customerName: name,
        agreementId: null,
        agreementStatus: "none",
        agreementLabel: "No agreement",
        waiverId: null,
        waiverStatus: "none",
        waiverLabel: "No waiver",
      });
    }

    const entry = byOrder.get(orderId)!;
    const status = doc.document_status ?? "pending";
    const statusLabel = status.replace(/\b\w/g, (c: string) => c.toUpperCase());

    if (doc.document_type === "rental_agreement") {
      entry.agreementId = doc.id;
      entry.agreementStatus = status;
      entry.agreementLabel = `Agreement: ${statusLabel}`;
    }

    if (doc.document_type === "safety_waiver") {
      entry.waiverId = doc.id;
      entry.waiverStatus = status;
      entry.waiverLabel = `Waiver: ${statusLabel}`;
    }
  }

  const mapped = Array.from(byOrder.values());
  const filtered = mapped.filter((doc) => matchesDetailedDocumentQuery(doc, query));

  return paginateItems(filtered, {
    page: options?.page,
    pageSize: options?.pageSize ?? 20,
    query,
  });
}

export async function getDocumentsDetailed(): Promise<DetailedDocument[]> {
  const result = await getDocumentsDetailedPage();
  return result.items;
}
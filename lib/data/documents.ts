import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import type { DocumentSummary } from "@/lib/types";

const fallbackDocuments: DocumentSummary[] = [
  { id: "doc_1", name: "Johnson Birthday Setup", agreement: "Rental agreement signed", waiver: "Safety waiver signed", orderId: "ord_1001" },
  { id: "doc_2", name: "Church Spring Event", agreement: "Agreement pending", waiver: "Waiver pending", orderId: "ord_1002" },
  { id: "doc_3", name: "School Field Day", agreement: "Rental agreement signed", waiver: "Safety waiver signed", orderId: "ord_1003" },
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
    .select("id, order_id, document_type, document_status, orders(order_number, customers(first_name, last_name))")
    .eq("organization_id", ctx.organizationId)
    .order("id", { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    return fallbackDocuments;
  }

  // Group by order
  const byOrder = new Map<string, { name: string; agreement: string; waiver: string; orderId: string }>();
  for (const doc of data) {
    const order = (doc as Record<string, unknown>).orders as { order_number: string; customers: { first_name: string; last_name: string } | null } | null;
    const orderId = doc.order_id ?? "";
    const customer = order?.customers;
    const name = customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : order?.order_number ?? "Document";

    if (!byOrder.has(orderId)) {
      byOrder.set(orderId, { name, agreement: "No agreement", waiver: "No waiver", orderId });
    }
    const entry = byOrder.get(orderId)!;
    const status = (doc.document_status ?? "pending").replace(/\b\w/g, (c: string) => c.toUpperCase());
    if (doc.document_type === "rental_agreement") entry.agreement = `Rental Agreement: ${status}`;
    if (doc.document_type === "safety_waiver") entry.waiver = `Safety Waiver: ${status}`;
  }

  return Array.from(byOrder.entries()).map(([, entry], i) => ({
    id: `doc_${i}`,
    ...entry,
  }));
}

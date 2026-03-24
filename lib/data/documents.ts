import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const fallbackDocuments = [
  {
    id: "doc_1",
    name: "Johnson Birthday Setup",
    agreement: "Rental agreement signed",
    waiver: "Safety waiver signed",
  },
  {
    id: "doc_2",
    name: "Church Spring Event",
    agreement: "Agreement pending",
    waiver: "Waiver pending",
  },
  {
    id: "doc_3",
    name: "School Field Day",
    agreement: "Rental agreement signed",
    waiver: "Safety waiver signed",
  },
];

export async function getDocuments() {
  if (!hasSupabaseEnv()) {
    return fallbackDocuments;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, order_id, document_type, document_status")
    .order("id", { ascending: false });

  if (error || !data) {
    return fallbackDocuments;
  }

  return data.map((document) => ({
    id: document.id,
    name: document.order_id ?? "Order document",
    agreement:
      document.document_type === "rental_agreement"
        ? document.document_status ?? "pending"
        : "See order",
    waiver:
      document.document_type === "safety_waiver"
        ? document.document_status ?? "pending"
        : "See order",
  }));
}

import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { generateDocumentPdf } from "@/lib/documents/generate-pdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Not available in demo mode" }, { status: 503 });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: document } = await supabase
    .from("documents")
    .select(`
      id, document_type, document_status,
      signed_date, signer_name, signer_ip, signature_data_url,
      orders!inner(
        order_number, event_date,
        order_items(item_name_snapshot),
        customers!inner(first_name, last_name),
        organization_id
      )
    `)
    .eq("id", documentId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("name, support_email")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  const order = document.orders as unknown as {
    order_number: string;
    event_date: string | null;
    order_items: { item_name_snapshot: string }[];
    customers: { first_name: string; last_name: string };
  };

  const customer = order.customers;
  const customerName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();

  const eventDate = order.event_date
    ? new Date(order.event_date + "T00:00:00").toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  const signedDate = document.signed_date
    ? new Date(document.signed_date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  const pdfBytes = generateDocumentPdf({
    documentType: document.document_type as "rental_agreement" | "safety_waiver",
    businessName: org?.name ?? "Rental Co",
    supportEmail: org?.support_email ?? "",
    orderNumber: order.order_number,
    customerName,
    eventDate,
    items: (order.order_items ?? []).map((i) => i.item_name_snapshot ?? "Item"),
    signedDate,
    signerName: document.signer_name ?? null,
    signerIp: document.signer_ip ?? null,
    signatureDataUrl: document.signature_data_url ?? null,
  });

  const docTitle = document.document_type === "rental_agreement"
    ? "Rental-Agreement"
    : "Safety-Waiver";
  const filename = `${docTitle}-${order.order_number}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";

export async function POST(request: NextRequest) {
  let body: { documentId: string; orderNumber: string; email: string; signerName: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { documentId, orderNumber, email, signerName } = body;

  if (!documentId || !orderNumber || !email || !signerName) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ ok: true, message: "Demo: Document signed." });
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Service not available." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();

  // Verify order exists and email matches
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id")
    .eq("organization_id", orgId)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("email")
    .eq("id", order.customer_id)
    .maybeSingle();

  if (!customer || customer.email?.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  // Update document
  const { error } = await supabase
    .from("documents")
    .update({
      document_status: "signed",
      signed_date: new Date().toISOString(),
      signer_name: signerName,
    })
    .eq("id", documentId)
    .eq("order_id", order.id);

  if (error) {
    return NextResponse.json({ error: "Failed to sign document." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Document signed successfully." });
}

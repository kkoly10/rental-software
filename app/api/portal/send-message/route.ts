import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv, getOptionalEnv } from "@/lib/env";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  let body: { orderNumber: string; email: string; subject: string; message: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { orderNumber, email, subject, message } = body;

  if (!orderNumber || !email || !subject || !message) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ error: "Message too long." }, { status: 400 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ ok: true, message: "Demo: Message sent." });
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Service not available." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();

  // Get org support email
  const { data: org } = await supabase
    .from("organizations")
    .select("name, support_email")
    .eq("id", orgId)
    .maybeSingle();

  const supportEmail = org?.support_email;

  // Try sending email via Resend if available
  const resendKey = getOptionalEnv("RESEND_API_KEY");
  if (resendKey && supportEmail) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: `${org?.name ?? "Korent"} <noreply@korent.io>`,
          to: supportEmail,
          reply_to: email,
          subject: `[Customer Message] ${subject} — Order ${orderNumber}`,
          html: `
            <h2>Customer Message</h2>
            <p><strong>Order:</strong> ${orderNumber}</p>
            <p><strong>From:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <hr />
            <p>${message.replace(/\n/g, "<br />")}</p>
          `,
        }),
      });
    } catch {
      // Email sending failed but don't block the response
    }
  }

  return NextResponse.json({ ok: true, message: "Message sent." });
}

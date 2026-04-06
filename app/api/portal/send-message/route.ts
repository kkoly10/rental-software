import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv, getOptionalEnv } from "@/lib/env";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

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

  // Rate limiting: 5 per 10 min per IP, 3 per 10 min per email
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const [ipLimit, emailLimit] = await Promise.all([
    enforceRateLimit({
      scope: "api:portal:send-message:ip",
      actor: clientIp,
      limit: 5,
      windowSeconds: 600,
    }),
    enforceRateLimit({
      scope: "api:portal:send-message:email",
      actor: email,
      limit: 3,
      windowSeconds: 600,
    }),
  ]);

  if (!ipLimit.allowed || !emailLimit.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a few minutes before trying again." },
      { status: 429 }
    );
  }

  // Block writes on demo org
  const orgId = await getPublicOrgId();
  const { blockDemoWrites } = await import("@/lib/demo/guard");
  const demoCheck = await blockDemoWrites(orgId);
  if (demoCheck.blocked) {
    return NextResponse.json({ error: demoCheck.message }, { status: 403 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ ok: true, message: "Demo: Message sent." });
  }

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

  // Look up order and customer for message persistence
  let orderId: string | null = null;
  let customerId: string | null = null;

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id")
    .eq("organization_id", orgId)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (order) {
    orderId = order.id;
    customerId = order.customer_id;
  }

  // Create notification for the operator (non-blocking)
  import("@/lib/data/notifications").then(({ createNotification }) =>
    createNotification(
      orgId,
      "new_message",
      "New customer message",
      `${subject} — Order #${orderNumber}`,
      "/dashboard/messages"
    )
  ).catch(() => {});

  // Persist the message in the database
  await supabase.from("messages").insert({
    organization_id: orgId,
    order_id: orderId,
    customer_id: customerId,
    direction: "inbound",
    channel: "portal",
    subject,
    body: message,
    sender_name: null,
    sender_email: email,
    read: false,
  });

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
          from: `${org?.name ?? "Korent"} <noreply@korent.app>`,
          to: supportEmail,
          reply_to: email,
          subject: `[Customer Message] ${subject} — Order ${orderNumber}`,
          html: `
            <h2>Customer Message</h2>
            <p><strong>Order:</strong> ${escapeHtml(orderNumber)}</p>
            <p><strong>From:</strong> ${escapeHtml(email)}</p>
            <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
            <hr />
            <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
          `,
        }),
      });
    } catch {
      // Email sending failed but don't block the response
    }
  }

  return NextResponse.json({ ok: true, message: "Message sent." });
}

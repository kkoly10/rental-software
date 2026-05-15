import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { hashPortalAccessToken, isPortalTokenExpired } from "@/lib/portal/access-token";
import { sendEmail } from "@/lib/email/send";

const VALID_SUBJECTS = [
  "Question about my order",
  "Request to reschedule",
  "Request to cancel",
  "Other",
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export async function POST(request: NextRequest) {
  let body: { portalToken: string; subject: string; message: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { portalToken, subject, message } = body;

  if (!portalToken || !subject || !message) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ error: "Message too long." }, { status: 400 });
  }

  if (!VALID_SUBJECTS.includes(subject)) {
    return NextResponse.json({ error: "Invalid subject." }, { status: 400 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const [ipLimit, tokenLimit] = await Promise.all([
    enforceRateLimit({
      scope: "api:portal:send-message:ip",
      actor: clientIp,
      limit: 5,
      windowSeconds: 600,
      strict: true,
    }),
    enforceRateLimit({
      scope: "api:portal:send-message:token",
      actor: hashPortalAccessToken(portalToken),
      limit: 3,
      windowSeconds: 600,
      strict: true,
    }),
  ]);

  if (!ipLimit.allowed || !tokenLimit.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a few minutes before trying again." },
      { status: 429 }
    );
  }

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
  const tokenHash = hashPortalAccessToken(portalToken);

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, order_number, portal_access_token_created_at")
    .eq("organization_id", orgId)
    .eq("portal_access_token_hash", tokenHash)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Invalid portal link." }, { status: 403 });
  }

  if (isPortalTokenExpired(order.portal_access_token_created_at)) {
    return NextResponse.json({ error: "This portal link has expired. Please request a new one." }, { status: 403 });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("email")
    .eq("id", order.customer_id)
    .maybeSingle();

  const senderEmail = customer?.email;
  if (!senderEmail) {
    return NextResponse.json({ error: "Unable to verify customer." }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("name, support_email")
    .eq("id", orgId)
    .maybeSingle();

  const supportEmail = org?.support_email;

  try {
    const { createNotification } = await import("@/lib/data/notifications");
    await createNotification(
      orgId,
      "new_message",
      "New customer message",
      `${subject} — Order #${order.order_number}`,
      "/dashboard/messages"
    );
  } catch {
    console.error("[portal] Failed to create notification for order", order.order_number);
  }

  await supabase.from("messages").insert({
    organization_id: orgId,
    order_id: order.id,
    customer_id: order.customer_id,
    direction: "inbound",
    channel: "portal",
    subject,
    body: message,
    sender_name: null,
    sender_email: senderEmail,
    read: false,
  });

  if (supportEmail) {
    const businessName = org?.name ?? "Rental Company";
    const rawFromAddress = process.env.EMAIL_FROM_ADDRESS ?? "noreply@korent.app";
    const fromEmail = rawFromAddress.replace(/^.*<(.+)>$/, "$1").trim();
    const safeName = businessName.replace(/[\r\n\t]/g, "").replace(/[^\w\s'-]/g, "").trim() || "Rental Company";

    await sendEmail({
      to: supportEmail,
      from: `${safeName} <${fromEmail}>`,
      replyTo: senderEmail,
      subject: `[Customer Message] ${subject} — Order ${order.order_number}`,
      html: `
        <h2>Customer Message</h2>
        <p><strong>Order:</strong> ${escapeHtml(order.order_number)}</p>
        <p><strong>From:</strong> ${escapeHtml(senderEmail)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <hr />
        <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
      `,
      organizationId: orgId,
      orderId: order.id,
    });
  }

  return NextResponse.json({ ok: true, message: "Message sent." });
}

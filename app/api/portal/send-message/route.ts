import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv, getOptionalEnv } from "@/lib/env";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { hashPortalAccessToken } from "@/lib/portal/access-token";

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
    .select("id, customer_id, order_number")
    .eq("organization_id", orgId)
    .eq("portal_access_token_hash", tokenHash)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Invalid portal link." }, { status: 403 });
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

  import("@/lib/data/notifications").then(({ createNotification }) =>
    createNotification(
      orgId,
      "new_message",
      "New customer message",
      `${subject} — Order #${order.order_number}`,
      "/dashboard/messages"
    )
  ).catch(() => {});

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
          reply_to: senderEmail,
          subject: `[Customer Message] ${subject} — Order ${order.order_number}`,
          html: `
            <h2>Customer Message</h2>
            <p><strong>Order:</strong> ${escapeHtml(order.order_number)}</p>
            <p><strong>From:</strong> ${escapeHtml(senderEmail)}</p>
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

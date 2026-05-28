"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { blockDemoWrites } from "@/lib/demo/guard";
import { hashPortalAccessToken, isPortalTokenExpired } from "@/lib/portal/access-token";

export type SendMessageState = {
  ok: boolean;
  message: string;
};

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

export async function sendCustomerMessage(
  _prevState: SendMessageState,
  formData: FormData
): Promise<SendMessageState> {
  const portalToken = String(formData.get("portal_token") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("message") ?? "").trim();

  if (!portalToken || !subject || !body) {
    return { ok: false, message: "All fields are required." };
  }

  if (!VALID_SUBJECTS.includes(subject)) {
    return { ok: false, message: "Invalid subject selected." };
  }

  if (body.length > 2000) {
    return { ok: false, message: "Message is too long (max 2000 characters)." };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: "Demo mode: Your message has been sent.",
    };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    return { ok: false, message: "Service not available." };
  }

  const demoCheck = await blockDemoWrites(orgId);
  if (demoCheck.blocked) {
    return { ok: false, message: demoCheck.message };
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
    return {
      ok: false,
      message: "Invalid portal access. Please reopen your portal link.",
    };
  }
  if (isPortalTokenExpired(order.portal_access_token_created_at)) {
    return { ok: false, message: "This portal link has expired. Contact us for a new one." };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("email")
    .eq("id", order.customer_id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  const senderEmail = customer?.email?.toLowerCase();
  if (!senderEmail) {
    return { ok: false, message: "Unable to verify your identity." };
  }

  try {
    const clientKey = await getActionClientKey();
    const [clientLimit, emailLimit] = await Promise.all([
      enforceRateLimit({
        scope: "portal:message:client",
        actor: clientKey,
        limit: 5,
        windowSeconds: 600,
        strict: true,
      }),
      enforceRateLimit({
        scope: "portal:message:email",
        actor: senderEmail,
        limit: 3,
        windowSeconds: 600,
        strict: true,
      }),
    ]);

    if (!clientLimit.allowed || !emailLimit.allowed) {
      return {
        ok: false,
        message: "Too many messages sent. Please wait before trying again.",
      };
    }
  } catch {
    return { ok: false, message: "Unable to send your message right now." };
  }

  const { error: insertErr } = await supabase.from("messages").insert({
    organization_id: orgId,
    order_id: order.id,
    customer_id: order.customer_id,
    direction: "inbound",
    channel: "portal",
    subject,
    body,
    sender_name: null,
    sender_email: senderEmail,
    read: false,
  });

  if (insertErr) {
    console.error("[portal] message insert failed:", insertErr.message);
    return { ok: false, message: "We couldn't deliver your message. Please try again or call the operator." };
  }

  try {
    const { logCommunication } = await import("@/lib/communications/log");
    await logCommunication({
      organizationId: orgId,
      orderId: order.id,
      customerId: order.customer_id,
      channel: "portal_message",
      direction: "inbound",
      recipient: null,
      subject,
      bodyPreview: body,
      status: "sent",
      metadata: { senderEmail },
    });
  } catch {
    console.error("[portal] Failed to log communication for order", order.order_number);
  }

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

  const { data: org } = await supabase
    .from("organizations")
    .select("name, support_email")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  // Fall back to the org owner's profile email so customer messages still
  // reach the operator when support_email is unset.
  let recipientEmail = org?.support_email ?? null;
  if (!recipientEmail) {
    const { data: ownerMembership } = await supabase
      .from("organization_memberships")
      .select("profiles(email)")
      .eq("organization_id", orgId)
      .eq("role", "owner")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    recipientEmail = (ownerMembership as { profiles?: { email?: string | null } | null } | null)
      ?.profiles?.email ?? null;
  }

  if (recipientEmail) {
    const safeBody = escapeHtml(body).replace(/\n/g, "<br />");
    const safeEmail = escapeHtml(senderEmail);
    const safeOrderNumber = escapeHtml(order.order_number);
    const safeSubject = escapeHtml(subject);

    await sendEmail({
      to: recipientEmail,
      subject: `[Customer Portal] ${subject} — Order #${order.order_number}`,
      html: `
        <h2>New message from customer portal</h2>
        <p><strong>Order:</strong> #${safeOrderNumber}</p>
        <p><strong>Customer email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <hr />
        <p>${safeBody}</p>
      `,
      replyTo: senderEmail,
      organizationId: orgId,
    });
  }

  return {
    ok: true,
    message: "Your message has been sent. We'll get back to you soon.",
  };
}

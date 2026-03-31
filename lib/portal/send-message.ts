"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { sendEmail } from "@/lib/email/send";

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

export async function sendCustomerMessage(
  _prevState: SendMessageState,
  formData: FormData
): Promise<SendMessageState> {
  const orderNumber = String(formData.get("order_number") ?? "").trim().toUpperCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("message") ?? "").trim();

  if (!orderNumber || !email || !subject || !body) {
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

  try {
    const clientKey = await getActionClientKey();
    const [clientLimit, emailLimit] = await Promise.all([
      enforceRateLimit({ scope: "portal:message:client", actor: clientKey, limit: 5, windowSeconds: 600 }),
      enforceRateLimit({ scope: "portal:message:email", actor: email, limit: 3, windowSeconds: 600 }),
    ]);

    if (!clientLimit.allowed || !emailLimit.allowed) {
      return { ok: false, message: "Too many messages sent. Please wait before trying again." };
    }
  } catch {
    return { ok: false, message: "Unable to send your message right now." };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    return { ok: false, message: "Service not available." };
  }

  const supabase = await createSupabaseServerClient();

  // Verify order + email match
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id")
    .eq("organization_id", orgId)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) {
    return { ok: false, message: "Order not found." };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("email")
    .eq("id", order.customer_id)
    .maybeSingle();

  if (!customer || customer.email?.toLowerCase() !== email) {
    return { ok: false, message: "Unable to verify your identity." };
  }

  // Fetch the org support email
  const { data: org } = await supabase
    .from("organizations")
    .select("name, support_email")
    .eq("id", orgId)
    .maybeSingle();

  const supportEmail = org?.support_email ?? "support@rentalos.io";

  // Send notification email to business
  await sendEmail({
    to: supportEmail,
    subject: `[Customer Portal] ${subject} — Order #${orderNumber}`,
    html: `
      <h2>New message from customer portal</h2>
      <p><strong>Order:</strong> #${orderNumber}</p>
      <p><strong>Customer email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <hr />
      <p>${body.replace(/\n/g, "<br />")}</p>
    `,
    replyTo: email,
    organizationId: orgId,
  });

  return { ok: true, message: "Your message has been sent. We'll get back to you soon." };
}

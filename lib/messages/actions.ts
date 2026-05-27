"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { escapeHtml } from "@/lib/maps/escape-html";

const replySchema = z.object({
  body: z.string().min(1, "Reply cannot be empty").max(5000),
  customerEmail: z.string().email("Valid customer email required"),
  customerId: z.string().nullable(),
  orderId: z.string().nullable(),
  orderNumber: z.string().max(100).nullable(),
});

export type ReplyActionState = {
  ok: boolean;
  message: string;
};

export async function sendReply(
  _prevState: ReplyActionState,
  formData: FormData
): Promise<ReplyActionState> {
  const parsed = replySchema.safeParse({
    body: formData.get("body"),
    customerEmail: formData.get("customer_email"),
    customerId: formData.get("customer_id") || null,
    orderId: formData.get("order_id") || null,
    orderNumber: formData.get("order_number") || null,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please check your reply.",
    };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Reply would be sent." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in to send replies." };
  }

  try {
    const clientKey = await getActionClientKey();
    const [userLimit, clientLimit] = await Promise.all([
      enforceRateLimit({
        scope: "messages:reply:user",
        actor: ctx.userId,
        limit: 30,
        windowSeconds: 300,
      }),
      enforceRateLimit({
        scope: "messages:reply:client",
        actor: clientKey,
        limit: 50,
        windowSeconds: 300,
      }),
    ]);

    if (!userLimit.allowed || !clientLimit.allowed) {
      return {
        ok: false,
        message: "Too many messages sent. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to send reply right now. Please try again shortly.",
    };
  }

  const { body, customerEmail, customerId, orderId, orderNumber } = parsed.data;
  const supabase = await createSupabaseServerClient();

  // Verify customerId and orderId belong to this org before inserting
  if (customerId) {
    const { data: custCheck } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!custCheck) return { ok: false, message: "Invalid customer." };
  }
  if (orderId) {
    const { data: orderCheck } = await supabase
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!orderCheck) return { ok: false, message: "Invalid order." };
  }

  const { data: replyMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(replyMembership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to send messages." };
  }

  // Get operator info for sender_name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.userId)
    .maybeSingle();

  // Insert reply into messages table
  const { error: insertError } = await supabase.from("messages").insert({
    organization_id: ctx.organizationId,
    order_id: orderId,
    customer_id: customerId,
    direction: "outbound",
    channel: "dashboard",
    subject: orderNumber ? `Re: Order #${orderNumber}` : "Reply from your rental company",
    body,
    sender_name: profile?.full_name ?? "Operator",
    sender_email: null,
    read: true,
  });

  if (insertError) {
    return { ok: false, message: "Failed to save reply." };
  }

  try {
    const { logCommunication } = await import("@/lib/communications/log");
    await logCommunication({
      organizationId: ctx.organizationId,
      orderId: orderId ?? undefined,
      customerId: customerId ?? undefined,
      channel: "portal_message",
      direction: "outbound",
      recipient: customerEmail,
      subject: orderNumber ? `Re: Order #${orderNumber}` : "Reply from operator",
      bodyPreview: body,
      status: "sent",
      metadata: { senderName: profile?.full_name ?? "Operator" },
    });
  } catch { /* non-critical — audit trail */ }

  // Send email to customer — awaited so operators know delivery succeeded
  try {
    const { sendEmail } = await import("@/lib/email/send");
    const { data: org } = await supabase
      .from("organizations")
      .select("name, support_email")
      .eq("id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    const businessName = org?.name ?? "Rental Company";
    const supportEmail = org?.support_email ?? null;

    const fromDomain = (process.env.EMAIL_FROM_ADDRESS ?? "noreply@korent.app").replace(/^.*<(.+)>$/, "$1").trim();
    const safeFromName = businessName.replace(/[\r\n\t]/g, "").replace(/[^\w\s'-]/g, "").trim() || "Rental Company";
    await sendEmail({
      to: customerEmail,
      from: `${safeFromName} <${fromDomain}>`,
      subject: orderNumber
        ? `Re: Order #${orderNumber} — ${businessName}`
        : `Message from ${businessName}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;">
          <p style="color:#10233f;font-size:14px;line-height:1.6;">${escapeHtml(body).replace(/\n/g, "<br />")}</p>
          <hr style="border:none;border-top:1px solid #dbe6f4;margin:24px 0;" />
          <p style="color:#55708f;font-size:13px;">
            Sent by ${escapeHtml(profile?.full_name ?? businessName)}${supportEmail ? ` · Reply to this email or contact us at ${escapeHtml(supportEmail)}` : " · Reply to this email"}
          </p>
        </div>
      `,
      replyTo: supportEmail ?? undefined,
      organizationId: ctx.organizationId,
    });
  } catch {
    console.error("[messages] Failed to send reply email — check email provider settings.");
    // Message row is already saved — returning ok:false here would prompt the
    // operator to retry, creating a duplicate row.  Return ok:true so the UI
    // closes the form, but surface the delivery warning in the toast.
    revalidatePath("/dashboard/messages");
    revalidatePath("/dashboard/messages/[id]", "page");
    return { ok: true, message: "Reply saved, but email delivery failed. Check your email provider settings." };
  }

  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard/messages/[id]", "page");

  return { ok: true, message: "Reply sent successfully." };
}

export async function fetchUnreadMessageCount(): Promise<number> {
  if (!hasSupabaseEnv()) return 1;

  const ctx = await getOrgContext();
  if (!ctx) return 0;

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .eq("direction", "inbound")
    .eq("read", false);

  return count ?? 0;
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  if (!hasSupabaseEnv()) return { ok: true };

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false };

  const supabase = await createSupabaseServerClient();
  const { error: markAllError } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("organization_id", ctx.organizationId)
    .eq("read", false);

  if (markAllError) return { ok: false };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markNotificationRead(
  notificationId: string
): Promise<{ ok: boolean }> {
  if (!hasSupabaseEnv()) return { ok: true };

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false };

  const supabase = await createSupabaseServerClient();
  const { error: markError } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("organization_id", ctx.organizationId);

  if (markError) return { ok: false };
  revalidatePath("/dashboard");
  return { ok: true };
}

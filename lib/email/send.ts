import { getResend, hasResendEnv } from "./client";
import { getOptionalEnv } from "@/lib/env";
import { logAppError, logAppEvent } from "@/lib/observability/server";
import { logCommunication } from "@/lib/communications/log";
import { enqueueEmailForRetry } from "./outbox";
import { signEmailViewToken } from "./view-token";
import { randomUUID } from "node:crypto";

function injectViewInBrowserLink(html: string, token: string): string {
  const siteUrl = getOptionalEnv("NEXT_PUBLIC_SITE_URL") ?? "";
  if (!siteUrl) return html;
  const url = `${siteUrl}/email-view/${encodeURIComponent(token)}`;
  // Tiny banner above the existing body content. Inline styles only —
  // some clients strip <head> styles.
  const banner = `<div style="text-align:right;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;color:#55708f;padding:8px 16px;background:#f4f7fb;"><a href="${url}" style="color:#55708f;text-decoration:underline;">View this email in your browser</a></div>`;
  // Insert just after <body ...>; if no <body>, prepend.
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, (m, attrs) => `<body${attrs}>${banner}`);
  }
  return banner + html;
}

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  organizationId?: string;
  orderId?: string | null;
  customerId?: string | null;
};

const DEFAULT_FROM_ADDRESS = getOptionalEnv("EMAIL_FROM_ADDRESS") ?? "noreply@korent.app";

/**
 * Send a transactional email via Resend.
 * Fails silently — email delivery should never block order flows.
 * Logs to communication_log for operator audit trail.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!payload.to?.trim()) {
    console.warn("[email] sendEmail called with empty recipient — skipping");
    return false;
  }

  if (!hasResendEnv()) {
    console.log(`[email-skip] No RESEND_API_KEY — would send email (recipient and subject redacted)`);
    return false;
  }

  const fromAddress = payload.from ?? DEFAULT_FROM_ADDRESS;
  // Pre-allocate the communication_log id so the view-in-browser link
  // baked into the body resolves to the same row we'll write below.
  const archiveId = payload.organizationId ? randomUUID() : null;
  const viewToken = archiveId ? signEmailViewToken(archiveId) : null;
  const htmlWithViewLink = viewToken
    ? injectViewInBrowserLink(payload.html, viewToken)
    : payload.html;

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: payload.to,
      subject: payload.subject,
      html: htmlWithViewLink,
      replyTo: payload.replyTo,
    });

    if (error) {
      await logAppError({
        organizationId: payload.organizationId,
        source: "email.send",
        message: `Email send failed: ${error.message}`,
        context: { subject: payload.subject },
      });

      // Log failed email to communication_log
      if (payload.organizationId) {
        await logCommunication({
          organizationId: payload.organizationId,
          orderId: payload.orderId,
          customerId: payload.customerId,
          channel: "email",
          direction: "outbound",
          recipient: payload.to,
          subject: payload.subject,
          bodyPreview: payload.html.replace(/<[^>]*>/g, "").slice(0, 200),
          status: "failed",
          metadata: { error: error.message },
        }).catch(() => {});
      }

      // Queue for retry. Resend's `error.message` rarely distinguishes
      // 4xx (permanent) from 5xx (transient), so we enqueue everything
      // and let the cron retry — bad addresses bottom out at MAX_ATTEMPTS.
      await enqueueEmailForRetry({
        organization_id: payload.organizationId ?? null,
        order_id: payload.orderId ?? null,
        customer_id: payload.customerId ?? null,
        to_email: payload.to,
        subject: payload.subject,
        html: payload.html,
        reply_to: payload.replyTo ?? null,
        from_address: fromAddress,
        last_error: error.message,
      });

      return false;
    }

    await logAppEvent({
      organizationId: payload.organizationId,
      source: "email.send",
      action: "sent",
      status: "success",
      metadata: { subject: payload.subject },
    });

    if (payload.organizationId) {
      await logCommunication({
        organizationId: payload.organizationId,
        orderId: payload.orderId,
        customerId: payload.customerId,
        channel: "email",
        direction: "outbound",
        recipient: payload.to,
        subject: payload.subject,
        bodyPreview: payload.html.replace(/<[^>]*>/g, "").slice(0, 200),
        status: "sent",
        metadata: { html: htmlWithViewLink },
        id: archiveId ?? undefined,
      }).catch(() => {});
    }

    return true;
  } catch (err) {
    await logAppError({
      organizationId: payload.organizationId,
      source: "email.send",
      message: err instanceof Error ? err.message : "Unknown email error",
      stack: err instanceof Error ? err.stack : undefined,
      context: { subject: payload.subject },
      error: err,
    });

    // Log failed email to communication_log
    if (payload.organizationId) {
      await logCommunication({
        organizationId: payload.organizationId,
        orderId: payload.orderId,
        customerId: payload.customerId,
        channel: "email",
        direction: "outbound",
        recipient: payload.to,
        subject: payload.subject,
        bodyPreview: payload.html.replace(/<[^>]*>/g, "").slice(0, 200),
        status: "failed",
        metadata: { error: err instanceof Error ? err.message : "Unknown" },
      }).catch(() => {});
    }

    // Network errors / SDK exceptions — enqueue for retry the same way
    // as Resend-returned errors above.
    await enqueueEmailForRetry({
      organization_id: payload.organizationId ?? null,
      order_id: payload.orderId ?? null,
      customer_id: payload.customerId ?? null,
      to_email: payload.to,
      subject: payload.subject,
      html: payload.html,
      reply_to: payload.replyTo ?? null,
      from_address: fromAddress,
      last_error: err instanceof Error ? err.message : "Unknown",
    });

    return false;
  }
}

import { getResend, hasResendEnv } from "./client";
import { getOptionalEnv } from "@/lib/env";
import { logAppError, logAppEvent } from "@/lib/observability/server";
import { logCommunication } from "@/lib/communications/log";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  organizationId?: string;
  orderId?: string | null;
  customerId?: string | null;
  /**
   * Optional plain-text alternative. When set, Resend includes it as the
   * `text/plain` MIME alternative, which improves spam scoring and renders
   * for plain-text-preferred clients. When omitted, sendEmail derives one
   * from the HTML body.
   */
  text?: string;
  /**
   * Plain-text "preheader" for the inbox preview. Becomes a hidden span at
   * the very top of the body — most clients show the first ~80 characters
   * of body text under the subject line.
   */
  preheader?: string;
  /**
   * Idempotency key: when set, `sendEmail` first looks for a recent
   * successful `communication_log` row keyed by `(organizationId,
   * orderId, idempotencyKey)`. If present, the send is skipped. Use this
   * for webhook handlers and retry-prone code paths.
   */
  idempotencyKey?: string;
  /**
   * Extra MIME headers (e.g., `List-Unsubscribe`). Caller is responsible
   * for sanitising values; sendEmail does not validate them further.
   */
  headers?: Record<string, string>;
};

const DEFAULT_FROM_ADDRESS = getOptionalEnv("EMAIL_FROM_ADDRESS") ?? "noreply@korent.app";

/**
 * Derive a plain-text body from the HTML, stripping tags and decoding the
 * most common entities. Conservative — anything fancier than the basics
 * (lists, tables, headings) is best handled by the caller.
 */
function deriveText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function alreadySent(
  organizationId: string,
  orderId: string | null | undefined,
  key: string
): Promise<boolean> {
  try {
    const { createSupabaseAdminClient, hasSupabaseServiceRoleEnv } = await import("@/lib/supabase/admin");
    if (!hasSupabaseServiceRoleEnv()) return false;
    const admin = createSupabaseAdminClient();
    let q = admin
      .from("communication_log")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("channel", "email")
      .eq("status", "sent")
      .contains("metadata", { idempotency_key: key });
    if (orderId) q = q.eq("order_id", orderId);
    const { count } = await q;
    return (count ?? 0) > 0;
  } catch {
    // Idempotency check is best-effort — never block a send because the
    // lookup itself errored.
    return false;
  }
}

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

  // Idempotency dedup: same (org, order, key) and a prior successful send
  // means this is a retry — skip and return true so the caller treats it
  // as success.
  if (payload.organizationId && payload.idempotencyKey) {
    const seen = await alreadySent(payload.organizationId, payload.orderId, payload.idempotencyKey);
    if (seen) {
      await logAppEvent({
        organizationId: payload.organizationId,
        source: "email.send",
        action: "deduped",
        status: "info",
        metadata: { subject: payload.subject, idempotencyKey: payload.idempotencyKey },
      });
      return true;
    }
  }

  const fromAddress = payload.from ?? DEFAULT_FROM_ADDRESS;
  const textBody = payload.text ?? deriveText(payload.html);
  // Embed the preheader at the top of the HTML body as a hidden span;
  // inbox clients render the first chunk of body text as the preview line.
  const html = payload.preheader
    ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${payload.preheader}</span>${payload.html}`
    : payload.html;

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: payload.to,
      subject: payload.subject,
      html,
      text: textBody,
      replyTo: payload.replyTo,
      headers: payload.headers,
    });

    if (error) {
      await logAppError({
        organizationId: payload.organizationId,
        source: "email.send",
        message: `Email send failed: ${error.message}`,
        context: { subject: payload.subject },
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
          status: "failed",
          metadata: {
            error: error.message,
            ...(payload.idempotencyKey ? { idempotency_key: payload.idempotencyKey } : {}),
          },
        }).catch(() => {});
      }

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
        metadata: payload.idempotencyKey
          ? { idempotency_key: payload.idempotencyKey }
          : undefined,
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
        metadata: {
          error: err instanceof Error ? err.message : "Unknown",
          ...(payload.idempotencyKey ? { idempotency_key: payload.idempotencyKey } : {}),
        },
      }).catch(() => {});
    }

    return false;
  }
}

/**
 * Build a `List-Unsubscribe` header value pointing at a mailto recipient.
 * For high-volume senders an https one-click URL is required by Gmail/Yahoo;
 * this mailto form is the minimum standards-compliant baseline.
 */
export function listUnsubscribeMailtoHeader(emailAddress: string): Record<string, string> {
  const cleaned = emailAddress.trim();
  if (!cleaned) return {};
  return {
    "List-Unsubscribe": `<mailto:${cleaned}>`,
  };
}

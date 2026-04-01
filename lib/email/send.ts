import { getResend, hasResendEnv } from "./client";
import { getOptionalEnv } from "@/lib/env";
import { logAppError, logAppEvent } from "@/lib/observability/server";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  organizationId?: string;
};

const DEFAULT_FROM = "Korent <noreply@korent.app>";

/**
 * Send a transactional email via Resend.
 * Fails silently — email delivery should never block order flows.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!hasResendEnv()) {
    console.log(`[email-skip] No RESEND_API_KEY — would send to ${payload.to}: ${payload.subject}`);
    return false;
  }

  const fromAddress = getOptionalEnv("EMAIL_FROM_ADDRESS") ?? DEFAULT_FROM;

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.replyTo,
    });

    if (error) {
      await logAppError({
        organizationId: payload.organizationId,
        source: "email.send",
        message: `Email send failed: ${error.message}`,
        context: { to: payload.to, subject: payload.subject },
      });
      return false;
    }

    await logAppEvent({
      organizationId: payload.organizationId,
      source: "email.send",
      action: "sent",
      status: "success",
      metadata: { to: payload.to, subject: payload.subject },
    });

    return true;
  } catch (err) {
    await logAppError({
      organizationId: payload.organizationId,
      source: "email.send",
      message: err instanceof Error ? err.message : "Unknown email error",
      stack: err instanceof Error ? err.stack : undefined,
      context: { to: payload.to, subject: payload.subject },
    });
    return false;
  }
}

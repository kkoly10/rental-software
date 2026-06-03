import { normalizePhoneE164 } from "../sms/provider.ts";

/**
 * WhatsApp Business send via Twilio (Sprint 4).
 *
 * Twilio acts as our WhatsApp Business Solution Provider (BSP) — same
 * Account SID + Auth Token as SMS, same Messages API endpoint, just
 * with the `whatsapp:` prefix on phone numbers and (for proactive
 * sends outside the 24h customer-initiated window) a ContentSid-based
 * template payload.
 *
 * The MVP supports two send shapes:
 *   1. **Template message** (`contentSid` provided). Required for any
 *      proactive notification because Meta enforces a 24h conversation
 *      window — outside it, only pre-approved templates can be sent.
 *      `contentVariables` map fills the template placeholders.
 *   2. **Freeform message** (just `body`). Only works when the
 *      customer has messaged us within the last 24h. Used for
 *      operator-replies to customer inquiries; not used by the
 *      transactional notification cron.
 *
 * The function never throws — Twilio failures are returned as a
 * structured error so the caller can fall back to SMS.
 */
export type WhatsAppMessage = {
  to: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
  body?: string;
};

export type WhatsAppResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export async function sendWhatsApp(
  message: WhatsAppMessage,
  options: { senderId: string },
): Promise<WhatsAppResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !authToken) {
    console.log("[WhatsApp Demo Mode] Would send WhatsApp (phone redacted)");
    return { ok: true, messageId: `demo-wa-${Date.now()}` };
  }

  const normalized = normalizePhoneE164(message.to);
  if (!normalized) {
    return { ok: false, error: "Invalid recipient phone number" };
  }

  const fromNumber = options.senderId.startsWith("whatsapp:")
    ? options.senderId
    : `whatsapp:${options.senderId}`;
  const toAddr = `whatsapp:${normalized}`;

  try {
    const params = new URLSearchParams();
    params.set("To", toAddr);
    params.set("From", fromNumber);

    if (message.contentSid) {
      params.set("ContentSid", message.contentSid);
      if (message.contentVariables && Object.keys(message.contentVariables).length > 0) {
        // Twilio expects a JSON-stringified map keyed by 1-based
        // template variable index, e.g. {"1": "Acme Rentals", "2": "$200"}.
        params.set("ContentVariables", JSON.stringify(message.contentVariables));
      }
    } else if (message.body) {
      params.set("Body", message.body);
    } else {
      return {
        ok: false,
        error: "WhatsApp message needs either contentSid or body",
      };
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${sid}:${authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const data = (await response.json()) as { sid?: string; message?: string };

    if (!response.ok) {
      return {
        ok: false,
        error: data.message || `Twilio WhatsApp error: ${response.status}`,
      };
    }
    return { ok: true, messageId: data.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown WhatsApp error";
    return { ok: false, error: message };
  }
}

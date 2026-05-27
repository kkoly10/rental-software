export type SmsMessage = {
  to: string;
  body: string;
};

export type SmsResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Normalize a phone number to E.164 so the provider does not reject common
 * stored formats like "(555) 123-4567" or "555-123-4567". Defaults to the
 * North American Numbering Plan (+1) for 10-digit input. Returns null when the
 * input cannot be confidently normalized.
 */
export function normalizePhoneE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export async function sendSms(message: SmsMessage): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !authToken || !fromNumber) {
    console.log("[SMS Demo Mode] Would send SMS (phone and body redacted)");
    return { ok: true, messageId: `demo-${Date.now()}` };
  }

  const to = normalizePhoneE164(message.to);
  if (!to) {
    return { ok: false, error: "Invalid recipient phone number" };
  }

  try {
    const params = new URLSearchParams();
    params.set("To", to);
    params.set("From", fromNumber);
    params.set("Body", message.body);

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
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: data.message || `Twilio error: ${response.status}`,
      };
    }

    return { ok: true, messageId: data.sid };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown SMS error";
    return { ok: false, error: errorMessage };
  }
}

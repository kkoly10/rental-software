export type SmsMessage = {
  to: string;
  body: string;
};

export type SmsResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export async function sendSms(message: SmsMessage): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !authToken || !fromNumber) {
    console.log("[SMS Demo Mode] Would send to", message.to, ":", message.body);
    return { ok: true, messageId: `demo-${Date.now()}` };
  }

  try {
    const params = new URLSearchParams();
    params.set("To", message.to);
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

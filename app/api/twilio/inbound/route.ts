import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { hasSupabaseServiceRoleEnv, createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneE164 } from "@/lib/sms/provider";
import { logAppError, logAppEvent } from "@/lib/observability/server";

// Public webhook — Twilio POSTs application/x-www-form-urlencoded.
// Authorization is provided by Twilio's HMAC signature header
// (X-Twilio-Signature) — see https://www.twilio.com/docs/usage/webhooks/webhooks-security.

const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START_KEYWORDS = new Set(["START", "YES", "UNSTOP"]);
// Sprint 4.5 — WhatsApp opt-in keywords. Operators send a prompt
// SMS via the customer page; the customer texts back one of these
// to flip whatsapp_opted_in. We accept both the explicit "WHATSAPP"
// and the more natural "WA YES" / "WAYES" variants so non-technical
// customers don't have to remember exact phrasing.
const WHATSAPP_OPT_IN_KEYWORDS = new Set([
  "WHATSAPP",
  "WHATSAPP YES",
  "WA YES",
  "WAYES",
  "WA",
]);
// Symmetric opt-out so a customer who said yes can change their mind
// without affecting SMS opt-in.
const WHATSAPP_OPT_OUT_KEYWORDS = new Set([
  "WHATSAPP STOP",
  "WHATSAPP NO",
  "WA STOP",
  "WA NO",
  "WANO",
]);

/**
 * Verify a Twilio webhook signature.
 *
 * Twilio signs the full URL + sorted form params with the account
 * auth token (HMAC-SHA1). We rebuild that input and compare. If the
 * auth token isn't configured we fail closed — better to drop an SMS
 * STOP and have the customer call than to honour an unsigned request
 * from an attacker pretending to be Twilio.
 */
function verifyTwilioSignature(request: NextRequest, params: Record<string, string>, fullUrl: string): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;

  const sig = request.headers.get("x-twilio-signature");
  if (!sig) return false;

  const sortedKeys = Object.keys(params).sort();
  const data = fullUrl + sortedKeys.map((k) => `${k}${params[k]}`).join("");
  const expected = crypto.createHmac("sha1", token).update(data).digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // Twilio always POSTs form-encoded.
  let formText: string;
  try {
    formText = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(formText)) {
    params[k] = v;
  }

  // Rebuild the URL Twilio signed: scheme + host + path, no query string
  // for application/x-www-form-urlencoded.
  const url = new URL(request.url);
  const fullUrl = `${url.protocol}//${url.host}${url.pathname}`;

  if (!verifyTwilioSignature(request, params, fullUrl)) {
    await logAppEvent({
      source: "twilio-inbound",
      action: "signature_rejected",
      status: "warning",
      route: "/api/twilio/inbound",
      metadata: { from: params.From, message_sid: params.MessageSid },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const fromRaw = params.From ?? "";
  const body = (params.Body ?? "").trim().toUpperCase();
  if (!fromRaw || !body) {
    return NextResponse.json({ ok: true, ignored: "empty" });
  }

  const fromE164 = normalizePhoneE164(fromRaw);
  if (!fromE164) {
    return NextResponse.json({ ok: true, ignored: "unrecognized_phone" });
  }

  const isStop = STOP_KEYWORDS.has(body);
  const isStart = START_KEYWORDS.has(body);
  const isWhatsAppOptIn = WHATSAPP_OPT_IN_KEYWORDS.has(body);
  const isWhatsAppOptOut = WHATSAPP_OPT_OUT_KEYWORDS.has(body);

  if (!isStop && !isStart && !isWhatsAppOptIn && !isWhatsAppOptOut) {
    // Not a compliance keyword; nothing to do here. Operators get the
    // message via the existing portal-message inbound path / messages
    // table; this endpoint is specifically TCPA-keyword handling.
    return NextResponse.json({ ok: true, ignored: "not_keyword" });
  }

  const admin = createSupabaseAdminClient();

  // SMS opt-in / opt-out (STOP / START / YES) — TCPA scope is the
  // phone number across orgs.
  if (isStop || isStart) {
    const { error: updateError } = await admin
      .from("customers")
      .update({
        sms_opt_in: !isStop,
        sms_opt_in_at: isStart ? new Date().toISOString() : null,
      })
      .eq("phone", fromE164);

    if (updateError) {
      await logAppError({
        source: "twilio-inbound",
        message: "Failed to update sms_opt_in on STOP/START",
        route: "/api/twilio/inbound",
        context: { phone_e164: fromE164, keyword: body, db_error: updateError.message },
      });
      return NextResponse.json({ error: "DB write failed" }, { status: 500 });
    }
  }

  // Sprint 4.5 — WhatsApp opt-in / opt-out. Same cross-org scope:
  // the customer's phone identifies them across every org that
  // booked them, and a single YES/NO reply should govern WhatsApp
  // delivery in all of them.
  if (isWhatsAppOptIn || isWhatsAppOptOut) {
    const { error: waError } = await admin
      .from("customers")
      .update({ whatsapp_opted_in: isWhatsAppOptIn })
      .eq("phone", fromE164);

    if (waError) {
      await logAppError({
        source: "twilio-inbound",
        message: "Failed to update whatsapp_opted_in on opt-in/opt-out keyword",
        route: "/api/twilio/inbound",
        context: { phone_e164: fromE164, keyword: body, db_error: waError.message },
      });
      return NextResponse.json({ error: "DB write failed" }, { status: 500 });
    }
  }

  await logAppEvent({
    source: "twilio-inbound",
    action: isStop
      ? "sms_opt_out"
      : isStart
      ? "sms_opt_in"
      : isWhatsAppOptIn
      ? "whatsapp_opt_in"
      : "whatsapp_opt_out",
    status: "info",
    route: "/api/twilio/inbound",
    metadata: { phone_e164: fromE164, keyword: body, message_sid: params.MessageSid },
  });

  // For WhatsApp opt-in/out we respond with a confirmation message
  // so the customer knows the change took. SMS STOP/START is already
  // handled by Twilio's automatic compliance replies, so we stay
  // silent there.
  if (isWhatsAppOptIn) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You\'re set. Future updates will come over WhatsApp when available. Reply WA STOP to switch back to SMS.</Message></Response>',
      { status: 200, headers: { "content-type": "application/xml" } },
    );
  }
  if (isWhatsAppOptOut) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Got it. Future updates will come over SMS. Reply WHATSAPP to switch back.</Message></Response>',
      { status: 200, headers: { "content-type": "application/xml" } },
    );
  }

  // Twilio expects an empty TwiML response to consume the inbound message
  // without sending an automatic reply. Twilio itself sends the
  // "You have been unsubscribed" confirmation for STOP, so we don't
  // need to add one here.
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    status: 200,
    headers: { "content-type": "application/xml" },
  });
}

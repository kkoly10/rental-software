/**
 * Messaging moderation rule engine (spec §18/§20) — pure and
 * deterministic. Hard-blocks only what the spec hard-blocks
 * (off-platform payment instructions, premature contact/address
 * sharing, suspicious links); soft-warns the rest. Phase-aware per
 * §24: once a booking is confirmed, operational coordination opens —
 * phone numbers and addresses become legitimate.
 */

export type ConversationPhase = "inquiry" | "coordination";

export type ModerationVerdict = {
  verdict: "clean" | "soft_warn" | "blocked";
  reasons: string[];
};

const PHONE_RE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PAYMENT_HANDLE_RE =
  /\b(venmo|zelle|cash\s?app|cashapp|paypal|apple\s?pay|wire\s+(me|the|transfer)|western\s+union)\b/i;
const URL_RE = /\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+/i;
const SHORTENER_RE = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|rb\.gy)\/\S+/i;
const OFF_PLATFORM_RE =
  /\b(off\s+the\s+app|outside\s+the\s+(app|platform|site)|cheaper\s+(off|outside)|avoid\s+the\s+fee|skip\s+the\s+fee|pay\s+me\s+direct(ly)?|deal\s+off)\b/i;
const SOCIAL_HANDLE_RE = /(^|\s)@[a-z0-9_.]{3,30}\b|\b(instagram|insta|ig|facebook|whatsapp|telegram|snap(chat)?)\b/i;

const ALLOWED_LINK_HOSTS = ["korent.app", "rent.korent.app"];

function hasDisallowedLink(body: string): boolean {
  const match = body.match(URL_RE);
  if (!match) return false;
  return !ALLOWED_LINK_HOSTS.some((host) => match[0].toLowerCase().includes(host));
}

export function moderateMessage(
  body: string,
  phase: ConversationPhase,
): ModerationVerdict {
  const reasons: string[] = [];
  let blocked = false;
  let warned = false;

  // Hard-blocks regardless of phase.
  if (PAYMENT_HANDLE_RE.test(body)) {
    blocked = true;
    reasons.push("payment_handle");
  }
  if (OFF_PLATFORM_RE.test(body)) {
    blocked = true;
    reasons.push("off_platform_payment");
  }
  if (SHORTENER_RE.test(body)) {
    blocked = true;
    reasons.push("link_shortener");
  }

  // Contact sharing: blocked pre-booking, allowed once coordination
  // opens (§24 — confirmed pre-handoff).
  if (phase === "inquiry") {
    if (PHONE_RE.test(body)) {
      blocked = true;
      reasons.push("phone_pre_booking");
    }
    if (EMAIL_RE.test(body)) {
      blocked = true;
      reasons.push("email_pre_booking");
    }
  }

  // Soft warnings.
  if (hasDisallowedLink(body)) {
    warned = true;
    reasons.push("external_link");
  }
  if (SOCIAL_HANDLE_RE.test(body)) {
    warned = true;
    reasons.push("social_handle");
  }

  if (blocked) return { verdict: "blocked", reasons };
  if (warned) return { verdict: "soft_warn", reasons };
  return { verdict: "clean", reasons };
}

/** Renter-visible explanation when a message is blocked. */
export function blockedMessageCopy(reasons: string[]): string {
  if (reasons.includes("phone_pre_booking") || reasons.includes("email_pre_booking")) {
    return "Contact details can be shared after a booking is confirmed — keep the conversation here until then.";
  }
  if (reasons.includes("payment_handle") || reasons.includes("off_platform_payment")) {
    return "Payments must stay on the platform — that's what protects your deposit and the booking.";
  }
  return "That message can't be sent — links like this aren't allowed.";
}

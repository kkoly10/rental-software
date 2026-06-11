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

/**
 * Bug #46/#58 — normalize before matching so obfuscation
 * (`v3nmo`, `v e n m o`, unicode digits, `name [at] gmail [dot] com`,
 * spelled-out digits) can't slip past the literal patterns. We match
 * against BOTH the raw body and this normalized form.
 */
function normalize(input: string): string {
  let s = input.toLowerCase();
  // Strip zero-width + fold common diacritics/homoglyphs.
  s = s.normalize("NFKD").replace(/[̀-ͯ​-‏⁠]/g, "");
  // Leetspeak → letters.
  s = s
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\$/g, "s")
    .replace(/@/g, "a");
  // "at"/"dot" obfuscation → symbols.
  s = s.replace(/\s*[\[(]?\s*at\s*[\])]?\s*/g, "@").replace(/\s*[\[(]?\s*dot\s*[\])]?\s*/g, ".");
  // Collapse inter-character spacing ("v e n m o" → "venmo").
  s = s.replace(/\b(\w(\s)){2,}\w\b/g, (m) => m.replace(/\s/g, ""));
  return s;
}

const SPELLED_DIGITS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};
function despell(input: string): string {
  return input
    .toLowerCase()
    .replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => SPELLED_DIGITS[w] ?? w);
}

const PHONE_RE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const LONG_DIGIT_RUN_RE = /\d[\s.-]?(?:\d[\s.-]?){8,}\d/; // 10+ digits any-separated
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PAYMENT_HANDLE_RE =
  /\b(venmo|zelle|cash\s?app|cashapp|paypal|apple\s?pay|google\s?pay|gpay|wire\s+(me|the|transfer)|western\s+union|zelle|cashme|paypal\.me)\b/i;
const URL_RE = /\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+/i;
const SHORTENER_RE = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|rb\.gy|cutt\.ly|shorturl)\/?\S*/i;
const OFF_PLATFORM_RE =
  /\b(off\s+the\s+app|outside\s+the\s+(app|platform|site)|cheaper\s+(off|outside)|avoid\s+the\s+fee|skip\s+the\s+fee|pay\s+me\s+direct(ly)?|deal\s+off|cash\s+(only|in\s+person)|pay\s+cash)\b/i;
const SOCIAL_HANDLE_RE = /(^|\s)@[a-z0-9_.]{3,30}\b|\b(instagram|insta|\big\b|facebook|whatsapp|telegram|snap(chat)?)\b/i;

const ALLOWED_LINK_HOSTS = ["korent.app", "rent.korent.app"];

/** Bug #54 — compare the parsed URL hostname, not a substring. */
function hasDisallowedLink(body: string): boolean {
  const match = body.match(URL_RE);
  if (!match) return false;
  let raw = match[0];
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return !ALLOWED_LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return true; // unparseable → treat as disallowed
  }
}

export function moderateMessage(
  body: string,
  phase: ConversationPhase,
): ModerationVerdict {
  const reasons: string[] = [];
  let blocked = false;
  let warned = false;

  // Match against raw + normalized + despelled forms so obfuscation
  // can't evade the patterns (#46/#58).
  const norm = normalize(body);
  const digits = despell(body);
  const hay = `${body}\n${norm}`;
  const test = (re: RegExp) => re.test(body) || re.test(norm);

  // Hard-blocks regardless of phase.
  if (test(PAYMENT_HANDLE_RE)) {
    blocked = true;
    reasons.push("payment_handle");
  }
  if (test(OFF_PLATFORM_RE)) {
    blocked = true;
    reasons.push("off_platform_payment");
  }
  if (SHORTENER_RE.test(hay)) {
    blocked = true;
    reasons.push("link_shortener");
  }

  // Contact sharing: blocked pre-booking, allowed once coordination
  // opens (§24 — confirmed pre-handoff).
  if (phase === "inquiry") {
    if (PHONE_RE.test(body) || PHONE_RE.test(digits) || LONG_DIGIT_RUN_RE.test(digits)) {
      blocked = true;
      reasons.push("phone_pre_booking");
    }
    if (test(EMAIL_RE)) {
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

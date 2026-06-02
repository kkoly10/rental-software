/**
 * Defenses against header-injection style attacks on outbound
 * artifacts (email subjects, Content-Disposition filenames, MAIL FROM
 * display names).
 *
 * None of these defenses are individually sufficient — they exist so a
 * single layer's bypass doesn't immediately yield CRLF / quote-break /
 * filename-spoof. Order matters: validate the source where possible
 * (zod schemas), then sanitize at the boundary as defense in depth.
 */

const HEADER_STRIP = /[\r\n\t\0]/g;
const FILENAME_ALLOWED = /[^A-Za-z0-9._-]/g;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * Strip characters that can break out of a single-line email / HTTP
 * header value (CR, LF, tab, NUL). Caps length so an unbounded user
 * field can't bloat a subject past server limits.
 *
 * Use for any user/org-controlled value interpolated into an email
 * `subject` or HTTP response header.
 */
export function sanitizeHeaderValue(value: string | null | undefined, maxLength = 200): string {
  if (!value) return "";
  const stripped = value.replace(HEADER_STRIP, "").trim();
  return stripped.length > maxLength ? stripped.slice(0, maxLength) : stripped;
}

/**
 * Reduce a user-supplied string to an ASCII-only filename token.
 * Replaces anything outside [A-Za-z0-9._-] with `_`. Caps length.
 *
 * Use for the dynamic part of `Content-Disposition: filename="..."`.
 * If you need to preserve non-ASCII characters, use filename* with
 * RFC 5987 encoding — but for invoice / quote downloads the
 * ASCII-only safe form is fine.
 */
export function safeFilenameToken(value: string | null | undefined, maxLength = 80): string {
  if (!value) return "file";
  const cleaned = value.replace(FILENAME_ALLOWED, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (!cleaned) return "file";
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/**
 * Conservative single-address email validation. Rejects strings with
 * CRLF, semicolons, commas (multi-address attempts), or that fail a
 * basic structural check. Returns the trimmed lowercase address on
 * success or null on failure.
 *
 * Note this is intentionally stricter than RFC 5321 — the goal is to
 * reject inputs that *might* be parsed as multiple recipients by
 * downstream MTAs, not to be a complete email validator.
 */
export function strictParseEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return null;
  if (/[\r\n\t\0;,<>"]/.test(trimmed)) return null;
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

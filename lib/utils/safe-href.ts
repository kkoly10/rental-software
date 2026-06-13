/**
 * URL-scheme safety helpers shared by validation (write-time) and rendering
 * (defense-in-depth). Reject javascript:, data:, and protocol-relative (//host)
 * URLs that can execute script or escape the origin.
 */

/** Same-site relative paths or absolute http(s) URLs only. */
export function isSafeHref(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  if (v.startsWith("//")) return false; // protocol-relative → off-site
  if (v.startsWith("#")) return true; // same-document fragment (anchor)
  if (v.startsWith("/")) return true; // same-site relative path
  return /^https?:\/\//i.test(v);
}

/** Absolute http(s) URL only (for fields that must be full URLs, e.g. socials). */
export function isAbsoluteHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

/** Returns the href if safe, otherwise a harmless fallback. */
export function sanitizeHref(value: string | null | undefined, fallback = "#"): string {
  return isSafeHref(value) ? (value as string).trim() : fallback;
}

/**
 * Prettifies category names that were stored as raw slugs.
 *
 * Some auto-created categories persist the slug as the display name
 * (e.g. "combo-units"), which then leaks into the storefront tiles
 * and filter dropdowns. When a name looks slug-like (contains hyphens,
 * no spaces, all lowercase) we title-case it for display:
 *   "combo-units" → "Combo Units"
 *
 * Names with spaces or any uppercase are operator-typed — return
 * them untouched.
 */
export function prettifyCategoryName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const slugLike = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmed) && trimmed.includes("-");
  if (!slugLike) return trimmed;
  return trimmed
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

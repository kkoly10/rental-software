/**
 * Bug #56 — single source of truth for the platform-admin gate.
 * Was duplicated in five files; a future edit to one copy wouldn't
 * propagate. PLATFORM_ADMIN_EMAILS is comma-separated; an empty/unset
 * value correctly denies everyone.
 */
export function isPlatformAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

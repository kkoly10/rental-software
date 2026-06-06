function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  let trimmed = value.trim();
  if (!trimmed) return null;
  // Vercel system vars (VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL) are
  // host-only with no scheme — assume https.
  if (!/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Canonical absolute origin for links that LEAVE the app — auth emails
 * (signup confirm, password reset), customer payment/quote links, crew
 * SMS, and OAuth redirect_uris.
 *
 * SECURITY: this is deliberately *never* derived from the request `Host` /
 * `X-Forwarded-Host` header. Those are attacker-controllable, and baked
 * into an emailed password-reset link they enable reset-poisoning — the
 * link carries the victim's token to the attacker's domain (PortSwigger /
 * OWASP). We fail closed to a trusted, platform-provided origin instead:
 *
 *   1. NEXT_PUBLIC_SITE_URL / SITE_URL — explicit canonical (set this in prod)
 *   2. VERCEL_PROJECT_PRODUCTION_URL   — Vercel's production domain (always set)
 *   3. VERCEL_URL                      — per-deploy URL (platform-set, trusted)
 *   4. http://localhost:3000           — local dev
 *
 * Defense-in-depth: Supabase's Redirect URL allowlist rejects any
 * redirectTo that isn't on the list, even if this ever returned something
 * unexpected.
 */
export async function getSiteUrl(): Promise<string> {
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL) ??
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeOrigin(process.env.VERCEL_URL) ??
    "http://localhost:3000"
  );
}

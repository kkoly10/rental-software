import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "dashboard",
  "help",
  "support",
  "blog",
  "status",
  "mail",
  "docs",
  "login",
  "signup",
  "onboarding",
  "checkout",
  "crew",
]);

/**
 * Generate a URL-safe slug from a business name.
 * Lowercase, replace non-alphanumeric with hyphens, collapse multiples, trim edges.
 */
export function generateSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

/**
 * Validate slug format: lowercase alphanumeric + hyphens, 3-63 chars,
 * cannot start or end with a hyphen.
 */
export function isValidSlugFormat(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(slug) && slug.length >= 3;
}

/**
 * Check if a slug is available (not taken and not reserved).
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  if (RESERVED_SLUGS.has(slug)) return false;
  if (!isValidSlugFormat(slug)) return false;
  if (!hasSupabaseEnv()) return true;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  return !data;
}

/**
 * Get the app domain from env. Defaults to localhost:3000 in dev.
 */
export function getAppDomain(): string {
  return process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost:3000";
}

/**
 * Resolve an organization ID from a request hostname.
 *
 * Priority:
 * 1. Verified custom_domain match → return org id
 * 2. Subdomain of app domain → lookup by slug → return org id
 * 3. Root app domain or "www" → return null (marketing/dashboard site)
 * 4. Localhost / Vercel preview → fall back to first org (dev mode)
 */
export async function resolveOrgFromHostname(
  hostname: string
): Promise<string | null> {
  if (!hasSupabaseEnv()) return null;

  const appDomain = getAppDomain();

  // Strip port for comparison
  const hostWithoutPort = hostname.split(":")[0];
  const appDomainWithoutPort = appDomain.split(":")[0];

  // Localhost or Vercel preview → dev fallback
  if (
    hostWithoutPort === "localhost" ||
    hostWithoutPort === "127.0.0.1" ||
    hostWithoutPort.endsWith(".vercel.app")
  ) {
    return devFallbackOrgId();
  }

  // Root app domain or www → marketing site, no tenant
  if (
    hostWithoutPort === appDomainWithoutPort ||
    hostWithoutPort === `www.${appDomainWithoutPort}`
  ) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  // Check if it's a subdomain of the app domain
  if (hostWithoutPort.endsWith(`.${appDomainWithoutPort}`)) {
    const subdomain = hostWithoutPort.slice(
      0,
      hostWithoutPort.length - appDomainWithoutPort.length - 1
    );

    if (!subdomain || subdomain === "www") return null;

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", subdomain)
      .limit(1)
      .maybeSingle();

    return org?.id ?? null;
  }

  // Otherwise, treat as a custom domain
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("custom_domain", hostWithoutPort)
    .eq("custom_domain_verified", true)
    .limit(1)
    .maybeSingle();

  return org?.id ?? null;
}

/**
 * Dev fallback: return the first org in the database (same as old getPublicOrgId).
 */
async function devFallbackOrgId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return org?.id ?? null;
}

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Extract the storefront slug from the middleware-injected x-tenant-host
 * header. PR #196 tightened the anon SELECT policies on organizations /
 * categories / products / product_images / product_attributes / service_areas
 * to require an x-storefront-slug header to match the row's organization. The
 * middleware (middleware.ts) sets x-tenant-host on tenant subdomain requests
 * — we translate that here into the format the RLS policy expects.
 *
 * For "jason.korent.app" → "jason". For root/marketing/dashboard requests
 * (no tenant host), returns null — the anon policy then sees no slug header
 * and correctly returns zero rows, which is the safe default.
 */
async function getStorefrontSlugFromRequest(): Promise<string | null> {
  try {
    const headersList = await headers();
    const tenantHost = headersList.get("x-tenant-host");
    if (!tenantHost) return null;
    // x-tenant-host is the full host that the middleware identified as a
    // tenant; the slug is the first label.
    const slug = tenantHost.split(".")[0]?.toLowerCase();
    return slug && slug !== "www" ? slug : null;
  } catch {
    // headers() throws when called outside a request context (e.g. during
    // certain background tasks). No tenant context → null is the safe answer.
    return null;
  }
}

export async function createSupabaseServerClient() {
  if (!hasSupabaseEnv()) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  const cookieStore = await cookies();
  const storefrontSlug = await getStorefrontSlugFromRequest();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // This can fail in Server Components — safe to ignore.
          // The cookie will be set by middleware or a Server Action instead.
        }
      },
    },
    // Sprint 6.0 P0 — inject x-storefront-slug on every Supabase request when
    // we're on a tenant subdomain. PostgREST surfaces this in the
    // request.headers GUC, which the anon SELECT policies read to scope
    // visibility to one org. Cross-tenant requests with the public anon key
    // (the original PR #196 threat) still see zero rows because they don't
    // come through our middleware and don't carry this header.
    global: storefrontSlug
      ? { headers: { "x-storefront-slug": storefrontSlug } }
      : undefined,
  });
}

/** Simple non-cookie client for data fetches that don't need auth */
export function createSupabaseServiceClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Admin client using the service role key — bypasses RLS entirely.
 * Only use server-side for internal lookups where the caller has already
 * authenticated the user via getUser(). Never expose to the client.
 */
export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

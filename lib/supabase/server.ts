import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function createSupabaseServerClient() {
  if (!hasSupabaseEnv()) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  const cookieStore = await cookies();

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

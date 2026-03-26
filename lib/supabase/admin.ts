import { createClient } from "@supabase/supabase-js";
import { getOptionalEnv, getRequiredEnv } from "@/lib/env";

export function hasSupabaseServiceRoleEnv() {
  return Boolean(getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export function createSupabaseAdminClient() {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

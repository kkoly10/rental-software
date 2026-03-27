import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CopilotAccessContext = {
  userId: string;
  email: string | null;
  organizationId: string;
};

export async function getCopilotAccessContext(): Promise<CopilotAccessContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email_confirmed_at) {
    return null;
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    organizationId: membership.organization_id,
  };
}

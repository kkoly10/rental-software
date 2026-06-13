"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/market/admin";

/**
 * Founder demand-triage action (Phase 2). Move a demand request along
 * its status (new → notified → matched → closed) as you act on the
 * supply-acquisition to-do list. Platform-admin only.
 */
const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "notified", "matched", "closed"]),
});

export async function updateDemandRequestStatus(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({
    id: formData.get("request_id"),
    status: formData.get("status"),
  });
  if (!parsed.success || !hasSupabaseEnv()) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdmin(user.email)) return;

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  await admin
    .from("market_demand_requests")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  revalidatePath("/dashboard/market-admin");
}

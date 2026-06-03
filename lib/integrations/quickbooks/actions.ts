"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncOrderToQuickBooks } from "./sync";

export type SyncActionState = {
  ok: boolean;
  message: string;
};

/**
 * Sprint 2 — manual "Sync to QuickBooks" button on the order detail
 * page. Useful during onboarding (operator confirms it works on a real
 * order before trusting the auto-sync) and for recovering from sync
 * failures that the daily reconcile cron hasn't picked up yet.
 *
 * Owner / admin / dispatcher can fire this — same role band as other
 * order-level mutations. Anyone else gets a 403-equivalent message.
 */
export async function manualSyncOrderToQuickBooks(
  _prev: SyncActionState,
  formData: FormData,
): Promise<SyncActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: order would have synced." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { ok: false, message: "Missing order id." };

  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(membership?.role ?? "")) {
    return { ok: false, message: "Only dispatchers and above can trigger sync." };
  }

  const result = await syncOrderToQuickBooks(
    supabase,
    ctx.organizationId,
    orderId,
  );

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/settings");

  if (!result.ok) {
    switch (result.reason) {
      case "not_connected":
        return {
          ok: false,
          message: "Connect QuickBooks first from Settings → Integrations.",
        };
      case "order_not_found":
        return { ok: false, message: "Order not found." };
      case "customer_not_found":
        return { ok: false, message: "Customer record is missing for this order." };
      case "token_refresh_failed":
        return {
          ok: false,
          message:
            "QuickBooks rejected the refresh token. Reconnect from Settings → Integrations.",
        };
      case "customer_sync_failed":
        return {
          ok: false,
          message: `Customer sync failed: ${result.detail ?? "unknown"}`,
        };
      case "invoice_create_failed":
        return {
          ok: false,
          message: `Invoice sync failed: ${result.detail ?? "unknown"}`,
        };
      default:
        return { ok: false, message: `Sync failed: ${result.reason}` };
    }
  }

  if (result.action === "noop") {
    return { ok: true, message: "Already synced to QuickBooks." };
  }
  return { ok: true, message: "Synced to QuickBooks." };
}

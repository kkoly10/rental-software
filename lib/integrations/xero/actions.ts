"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncOrderToXero } from "./sync";

export type XeroSyncActionState = { ok: boolean; message: string };

/**
 * Manual "Sync to Xero" button server action (Sprint 3.5). Same shape
 * as the QBO manual sync — owner/admin/dispatcher only, surfaces a
 * clear message per documented failure reason.
 */
export async function manualSyncOrderToXero(
  _prev: XeroSyncActionState,
  formData: FormData,
): Promise<XeroSyncActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: order would have synced to Xero." };
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
    return { ok: false, message: "Only dispatchers and above can trigger Xero sync." };
  }

  const result = await syncOrderToXero(supabase, ctx.organizationId, orderId);

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/settings");

  if (!result.ok) {
    switch (result.reason) {
      case "not_connected":
        return { ok: false, message: "Connect Xero first from Settings → Integrations." };
      case "order_not_found":
        return { ok: false, message: "Order not found." };
      case "customer_not_found":
        return { ok: false, message: "Customer record is missing for this order." };
      case "token_refresh_failed":
        return { ok: false, message: "Xero rejected the refresh token. Reconnect from Settings → Integrations." };
      case "contact_sync_failed":
        return { ok: false, message: `Contact sync failed: ${result.detail ?? "unknown"}` };
      case "invoice_create_failed":
        return { ok: false, message: `Invoice sync failed: ${result.detail ?? "unknown"}` };
      default:
        return { ok: false, message: `Sync failed: ${result.reason}` };
    }
  }

  if (result.action === "noop") return { ok: true, message: "Already synced to Xero." };
  return { ok: true, message: "Synced to Xero." };
}

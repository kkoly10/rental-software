"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { hashPortalAccessToken, isPortalTokenExpired } from "@/lib/portal/access-token";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getActionClientKey } from "@/lib/security/action-client";
import { blockDemoWrites } from "@/lib/demo/guard";
import { revalidatePath } from "next/cache";

export type AcceptQuoteState = { ok: boolean; message: string };

export async function acceptQuote(
  _prev: AcceptQuoteState,
  formData: FormData
): Promise<AcceptQuoteState> {
  const token = String(formData.get("portal_token") ?? "").trim();
  if (!token) return { ok: false, message: "Invalid portal link." };

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Quote accepted." };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) return { ok: false, message: "Service unavailable." };

  const demoCheck = await blockDemoWrites(orgId);
  if (demoCheck.blocked) return { ok: false, message: demoCheck.message };

  try {
    const clientKey = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "portal:accept-quote:client",
      actor: clientKey,
      limit: 10,
      windowSeconds: 300,
      strict: true,
    });
    if (!limit.allowed) {
      return { ok: false, message: "Too many attempts. Please wait a moment." };
    }
  } catch {
    return { ok: false, message: "Unable to process right now." };
  }

  const supabase = await createSupabaseServerClient();
  const tokenHash = hashPortalAccessToken(token);

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_status, portal_access_token_created_at")
    .eq("organization_id", orgId)
    .eq("portal_access_token_hash", tokenHash)
    .maybeSingle();

  if (!order) return { ok: false, message: "Order not found." };
  if (isPortalTokenExpired(order.portal_access_token_created_at)) {
    return { ok: false, message: "This portal link has expired. Contact us for a new one." };
  }

  if (order.order_status !== "quote_sent") {
    return { ok: false, message: "This quote has already been actioned or is no longer pending." };
  }

  const { error } = await supabase
    .from("orders")
    .update({ order_status: "awaiting_deposit" })
    .eq("id", order.id)
    .eq("order_status", "quote_sent");

  if (error) return { ok: false, message: "Failed to accept quote. Please try again." };

  revalidatePath("/order-status");
  return { ok: true, message: "Quote accepted! Please pay your deposit to confirm your booking." };
}

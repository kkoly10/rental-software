"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { updateOrderDeliveryAddressSchema } from "@/lib/validation/orders";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export type AddressActionState = {
  ok: boolean;
  message: string;
};

/**
 * Tier-1 launch fix — add or edit the delivery address on an
 * existing order. The new-order form leaves the address optional
 * (phone inquiries legitimately lack one), but the QA Phase-2 walk
 * showed those orders get permanently stranded at `confirmed`: the
 * routing card blocks with "Add a delivery address before routing
 * this order" and there was NO surface anywhere to actually add it.
 *
 * Creates a customer_addresses row when the order has none, or
 * updates the linked row in place when it does. Owner / admin /
 * dispatcher only — the same roles that can route the order.
 */
export async function updateOrderDeliveryAddress(
  _prev: AddressActionState,
  formData: FormData,
): Promise<AddressActionState> {
  const parsed = updateOrderDeliveryAddressSchema.safeParse({
    orderId: String(formData.get("order_id") ?? ""),
    line1: String(formData.get("line1") ?? ""),
    line2: String(formData.get("line2") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    postalCode: String(formData.get("postal_code") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Please review the address details.",
    };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: address would be saved." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  try {
    const limit = await enforceRateLimit({
      scope: "orders:update-address:user",
      actor: ctx.userId,
      limit: 40,
      windowSeconds: 300,
    });
    if (!limit.allowed) {
      return {
        ok: false,
        message: "Too many address updates. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to update the address right now. Please try again shortly.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(membership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to edit this order." };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, customer_id, delivery_address_id")
    .eq("id", parsed.data.orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (orderError || !order) {
    return { ok: false, message: "Order not found." };
  }
  if (!order.customer_id) {
    // Addresses hang off the customer record; an order without one
    // can't carry an address. Shouldn't happen in practice — every
    // creation path writes a customer first.
    return { ok: false, message: "This order has no customer to attach an address to." };
  }

  const addressRow = {
    line1: parsed.data.line1,
    line2: parsed.data.line2 ?? null,
    city: parsed.data.city,
    state: parsed.data.state,
    postal_code: parsed.data.postalCode,
  };

  if (order.delivery_address_id) {
    const { error } = await supabase
      .from("customer_addresses")
      .update(addressRow)
      .eq("id", order.delivery_address_id)
      .eq("organization_id", ctx.organizationId);
    if (error) {
      console.error("[orders] address update failed:", error.message);
      return { ok: false, message: "Couldn't save the address. Please try again." };
    }
  } else {
    const { data: inserted, error } = await supabase
      .from("customer_addresses")
      .insert({
        organization_id: ctx.organizationId,
        customer_id: order.customer_id,
        ...addressRow,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      console.error("[orders] address insert failed:", error?.message);
      return { ok: false, message: "Couldn't save the address. Please try again." };
    }
    const { error: linkError } = await supabase
      .from("orders")
      .update({ delivery_address_id: inserted.id })
      .eq("id", order.id)
      .eq("organization_id", ctx.organizationId);
    if (linkError) {
      console.error("[orders] address link failed:", linkError.message);
      return { ok: false, message: "Couldn't link the address to the order. Please try again." };
    }
  }

  revalidatePath(`/dashboard/orders/${order.id}`);
  revalidatePath("/dashboard/orders");
  return { ok: true, message: "Delivery address saved." };
}

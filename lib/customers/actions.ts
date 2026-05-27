"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { updateCustomerSchema } from "@/lib/validation/customers";

export type CustomerActionState = {
  ok: boolean;
  message: string;
};

export async function updateCustomer(
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const parsed = updateCustomerSchema.safeParse({
    customerId: String(formData.get("customer_id") ?? ""),
    firstName: String(formData.get("first_name") ?? ""),
    lastName: String(formData.get("last_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    addressLine1: String(formData.get("address_line1") ?? ""),
    addressLine2: String(formData.get("address_line2") ?? ""),
    addressCity: String(formData.get("address_city") ?? ""),
    addressState: String(formData.get("address_state") ?? ""),
    addressZip: String(formData.get("address_zip") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Please review the customer details.",
    };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Customer would be updated." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  try {
    const clientKey = await getActionClientKey();
    const userLimit = await enforceRateLimit({
      scope: "customers:update:user",
      actor: ctx.userId,
      limit: 30,
      windowSeconds: 300,
    });
    const clientLimit = await enforceRateLimit({
      scope: "customers:update:client",
      actor: clientKey,
      limit: 50,
      windowSeconds: 300,
    });

    if (!userLimit.allowed || !clientLimit.allowed) {
      return {
        ok: false,
        message: "Too many customer updates. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to update customer right now. Please try again shortly.",
    };
  }

  const {
    customerId,
    firstName,
    lastName,
    email,
    phone,
    notes,
    addressLine1,
    addressLine2,
    addressCity,
    addressState,
    addressZip,
  } = parsed.data;

  const supabase = await createSupabaseServerClient();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(membership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to update customers." };
  }

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      first_name: firstName,
      last_name: lastName,
      email: email ?? null,
      phone: phone ?? null,
      notes: notes ?? null,
    })
    .eq("id", customerId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  // Upsert default delivery address if address fields provided
  if (addressLine1 && addressCity) {
    const { data: existingAddr } = await supabase
      .from("customer_addresses")
      .select("id")
      .eq("customer_id", customerId)
      .eq("is_default_delivery", true)
      .is("deleted_at", null)
      .maybeSingle();

    const addressPayload = {
      line1: addressLine1,
      line2: addressLine2 ?? null,
      city: addressCity,
      state: addressState ?? null,
      postal_code: addressZip ?? null,
    };

    if (existingAddr) {
      const { error: addrErr } = await supabase
        .from("customer_addresses")
        .update(addressPayload)
        .eq("id", existingAddr.id)
        .eq("customer_id", customerId)
        .is("deleted_at", null);

      if (addrErr) {
        console.error("[customers] Failed to update address:", addrErr.message);
        return { ok: false, message: "Customer info saved but address update failed. Please try again." };
      }
    } else {
      const { error: addrErr } = await supabase
        .from("customer_addresses")
        .insert({
          customer_id: customerId,
          is_default_delivery: true,
          ...addressPayload,
        });

      if (addrErr) {
        console.error("[customers] Failed to create address:", addrErr.message);
        return { ok: false, message: "Customer info saved but address could not be stored. Please try again." };
      }
    }
  } else {
    // Address fields were cleared in the form — soft-delete the stored default
    // delivery address so a removed address doesn't keep displaying.
    await supabase
      .from("customer_addresses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("customer_id", customerId)
      .eq("is_default_delivery", true)
      .is("deleted_at", null);
  }

  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath("/dashboard/customers");

  return { ok: true, message: "Customer updated successfully." };
}

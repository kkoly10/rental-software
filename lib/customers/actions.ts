"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logAppEvent, logAppError } from "@/lib/observability/server";
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
    preferredLocale: String(formData.get("preferred_locale") ?? "en"),
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
    preferredLocale,
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

  const { data: updatedCustomer, error: updateError } = await supabase
    .from("customers")
    .update({
      first_name: firstName,
      last_name: lastName,
      email: email ?? null,
      phone: phone ?? null,
      notes: notes ?? null,
      preferred_locale: preferredLocale,
    })
    .eq("id", customerId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .select("id");

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  // customer_addresses has no organization_id column, so confirm the customer
  // actually belongs to this org before touching addresses by raw customer_id.
  if (!updatedCustomer || updatedCustomer.length === 0) {
    return { ok: false, message: "Customer not found." };
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
          organization_id: ctx.organizationId,
          is_default_delivery: true,
          ...addressPayload,
        });

      if (addrErr) {
        console.error("[customers] Failed to create address:", addrErr.message);
        return { ok: false, message: "Customer info saved but address could not be stored. Please try again." };
      }
    }
  } else if (!addressLine1 && !addressCity) {
    // Both address fields were cleared — soft-delete the stored default
    // delivery address. (Partial input is treated as a no-op so a half-filled
    // edit doesn't silently destroy stored data.)
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

/**
 * GDPR-style erasure: anonymizes the customer's PII (name, email, phone,
 * notes) and soft-deletes the row plus their stored addresses. Orders and
 * payments stay intact because the operator still needs the financial
 * record — the customer is now stored as "Deleted Customer" with no
 * direct identifiers.
 *
 * Owner / admin only; rate-limited; org-scoped; audit-logged.
 */
export async function anonymizeAndDeleteCustomer(
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const customerId = String(formData.get("customer_id") ?? "").trim();
  if (!customerId) {
    return { ok: false, message: "Customer is required." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Customer would be anonymized and deleted." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  try {
    const clientKey = await getActionClientKey();
    const [userLimit, clientLimit] = await Promise.all([
      enforceRateLimit({
        scope: "customers:delete:user",
        actor: ctx.userId,
        // Erasure is destructive; keep the cap tight.
        limit: 5,
        windowSeconds: 300,
      }),
      enforceRateLimit({
        scope: "customers:delete:client",
        actor: clientKey,
        limit: 10,
        windowSeconds: 300,
      }),
    ]);
    if (!userLimit.allowed || !clientLimit.allowed) {
      return {
        ok: false,
        message: "Too many delete attempts. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to process the request right now.",
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
  if (!["owner", "admin"].includes(membership?.role ?? "")) {
    return {
      ok: false,
      message: "Only owners and admins can delete customer records.",
    };
  }

  // Confirm the customer belongs to this org before we touch anything.
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!customer) {
    return { ok: false, message: "Customer not found." };
  }

  const now = new Date().toISOString();

  // Anonymise the row in the same UPDATE that flips deleted_at so a
  // partial failure can't leave PII behind on a still-active record.
  const { error: anonError } = await supabase
    .from("customers")
    .update({
      first_name: "Deleted",
      last_name: "Customer",
      email: null,
      phone: null,
      notes: null,
      sms_opt_in: false,
      deleted_at: now,
    })
    .eq("id", customerId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);

  if (anonError) {
    await logAppError({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      source: "customers.anonymize",
      message: `customers anonymize update failed: ${anonError.message}`,
      context: { customerId },
    });
    return { ok: false, message: "Couldn't delete the customer. Please try again." };
  }

  // Soft-delete every address row attached to this customer. Org scoping is
  // enforced via the customer_id chain + RLS; we still verified ownership
  // above so the FK reach is safe.
  const { error: addrError } = await supabase
    .from("customer_addresses")
    .update({ deleted_at: now })
    .eq("customer_id", customerId)
    .is("deleted_at", null);

  if (addrError) {
    await logAppError({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      source: "customers.anonymize",
      message: `addresses soft-delete failed: ${addrError.message}`,
      context: { customerId },
    });
    // Customer is already anonymised; surface a warning but don't revert.
  }

  await logAppEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    source: "customers.anonymize",
    action: "anonymize_and_delete",
    status: "success",
    metadata: { customerId },
  });

  revalidatePath("/dashboard/customers");
  redirect("/dashboard/customers");
}

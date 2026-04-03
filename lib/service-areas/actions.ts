"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import {
  archiveServiceAreaSchema,
  createServiceAreaSchema,
  updateServiceAreaSchema,
} from "@/lib/validation/service-areas";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export type ServiceAreaActionState = {
  ok: boolean;
  message: string;
};

const initialState: ServiceAreaActionState = {
  ok: false,
  message: "",
};

async function checkServiceAreaRateLimit(scope: "create" | "update" | "archive", userId: string) {
  const clientKey = await getActionClientKey();

  const [userLimit, clientLimit] = await Promise.all([
    enforceRateLimit({
      scope: `service-areas:${scope}:user`,
      actor: userId,
      limit: 30,
      windowSeconds: 300,
    }),
    enforceRateLimit({
      scope: `service-areas:${scope}:client`,
      actor: clientKey,
      limit: 50,
      windowSeconds: 300,
    }),
  ]);

  return userLimit.allowed && clientLimit.allowed;
}

function buildPostalCodes(primaryPostalCode: string, postalCodesInput: string[]) {
  const all = [primaryPostalCode, ...postalCodesInput].filter(Boolean);
  return Array.from(new Set(all));
}

export async function createServiceArea(
  _prevState: ServiceAreaActionState = initialState,
  formData: FormData
): Promise<ServiceAreaActionState> {
  const parsed = createServiceAreaSchema.safeParse({
    label: String(formData.get("label") ?? ""),
    primaryPostalCode: String(formData.get("primary_postal_code") ?? ""),
    postalCodesInput: String(formData.get("postal_codes") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    deliveryFee: String(formData.get("delivery_fee") ?? "0"),
    minimumOrderAmount: String(formData.get("minimum_order_amount") ?? "0"),
    isActive: formData.get("is_active") !== null,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the service area details.",
    };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: service area \"${parsed.data.label}\" would be created.`,
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in to manage service areas." };
  }

  try {
    const allowed = await checkServiceAreaRateLimit("create", ctx.userId);
    if (!allowed) {
      return {
        ok: false,
        message: "Too many service area changes. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to save service areas right now. Please try again shortly.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const postalCodes = buildPostalCodes(
    parsed.data.primaryPostalCode,
    parsed.data.postalCodesInput
  );

  const { error } = await supabase.from("service_areas").insert({
    organization_id: ctx.organizationId,
    label: parsed.data.label,
    zip_code: parsed.data.primaryPostalCode,
    postal_codes: postalCodes,
    city: parsed.data.city ?? null,
    state: parsed.data.state ?? null,
    delivery_fee: parsed.data.deliveryFee,
    minimum_order_amount: parsed.data.minimumOrderAmount,
    is_active: parsed.data.isActive,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  // Track setup progress (non-blocking)
  import("@/lib/guidance/update-setup-progress").then(({ markSetupStep }) =>
    markSetupStep(ctx.organizationId, "has_service_area")
  ).catch(() => {});

  revalidatePath("/dashboard/service-areas");
  return { ok: true, message: "Service area created." };
}

export async function updateServiceArea(
  _prevState: ServiceAreaActionState = initialState,
  formData: FormData
): Promise<ServiceAreaActionState> {
  const parsed = updateServiceAreaSchema.safeParse({
    serviceAreaId: String(formData.get("service_area_id") ?? ""),
    label: String(formData.get("label") ?? ""),
    primaryPostalCode: String(formData.get("primary_postal_code") ?? ""),
    postalCodesInput: String(formData.get("postal_codes") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    deliveryFee: String(formData.get("delivery_fee") ?? "0"),
    minimumOrderAmount: String(formData.get("minimum_order_amount") ?? "0"),
    isActive: formData.get("is_active") !== null,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the service area details.",
    };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: service area \"${parsed.data.label}\" would be updated.`,
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in to manage service areas." };
  }

  try {
    const allowed = await checkServiceAreaRateLimit("update", ctx.userId);
    if (!allowed) {
      return {
        ok: false,
        message: "Too many service area changes. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to save service areas right now. Please try again shortly.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const postalCodes = buildPostalCodes(
    parsed.data.primaryPostalCode,
    parsed.data.postalCodesInput
  );

  const { error } = await supabase
    .from("service_areas")
    .update({
      label: parsed.data.label,
      zip_code: parsed.data.primaryPostalCode,
      postal_codes: postalCodes,
      city: parsed.data.city ?? null,
      state: parsed.data.state ?? null,
      delivery_fee: parsed.data.deliveryFee,
      minimum_order_amount: parsed.data.minimumOrderAmount,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.serviceAreaId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/service-areas");
  return { ok: true, message: "Service area updated." };
}

export async function archiveServiceArea(serviceAreaId: string): Promise<ServiceAreaActionState> {
  const parsed = archiveServiceAreaSchema.safeParse({ serviceAreaId });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid service area request.",
    };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: service area would be archived." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in to manage service areas." };
  }

  try {
    const allowed = await checkServiceAreaRateLimit("archive", ctx.userId);
    if (!allowed) {
      return {
        ok: false,
        message: "Too many service area changes. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to save service areas right now. Please try again shortly.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("service_areas")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.serviceAreaId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/service-areas");
  return { ok: true, message: "Service area archived." };
}

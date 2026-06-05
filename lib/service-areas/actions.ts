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

/**
 * Look for any ACTIVE service area in this org that already covers one
 * of the postal codes the operator is trying to add. Returns the
 * conflicting area's label + the overlapping ZIPs so the action can
 * tell the operator exactly why we won't save — instead of letting the
 * insert succeed and confuse storefront coverage resolution down the
 * line. Excludes a specific id when called from updateServiceArea so an
 * edit that doesn't change the ZIPs doesn't trip over itself.
 */
async function findOverlappingArea(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  postalCodes: string[],
  excludeId?: string,
): Promise<{ label: string; overlap: string[] } | null> {
  if (postalCodes.length === 0) return null;
  const { data: areas } = await supabase
    .from("service_areas")
    .select("id, label, zip_code, postal_codes")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .is("deleted_at", null);
  if (!areas) return null;
  const requested = new Set(postalCodes.map((p) => p.trim()).filter(Boolean));
  for (const a of areas) {
    if (excludeId && a.id === excludeId) continue;
    const existing: string[] = [];
    if (typeof a.zip_code === "string" && a.zip_code) existing.push(a.zip_code);
    if (Array.isArray(a.postal_codes)) {
      for (const p of a.postal_codes) {
        if (typeof p === "string" && p) existing.push(p);
      }
    }
    const overlap = existing.filter((p) => requested.has(p));
    if (overlap.length > 0) {
      return { label: (a.label as string) ?? "Existing area", overlap: Array.from(new Set(overlap)) };
    }
  }
  return null;
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

  const { data: saMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(saMembership?.role ?? "")) {
    return { ok: false, message: "Only dispatchers and above can manage service areas." };
  }

  const postalCodes = buildPostalCodes(
    parsed.data.primaryPostalCode,
    parsed.data.postalCodesInput
  );

  // Stop the operator from creating two areas that both claim the same
  // ZIP. The storefront's coverage lookup ties-breaks by `updated_at` if
  // there are duplicates and logs a warning, but the right time to
  // catch this is at save-time so the operator can fix it instead of
  // shipping customers a silently-resolved fee.
  const conflict = await findOverlappingArea(
    supabase,
    ctx.organizationId,
    postalCodes,
  );
  if (conflict) {
    return {
      ok: false,
      message: `ZIP ${conflict.overlap.join(", ")} is already covered by "${conflict.label}". Move it there or remove it from this new area before saving.`,
    };
  }

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

  try {
    const { markSetupStep } = await import("@/lib/guidance/update-setup-progress");
    await markSetupStep(ctx.organizationId, "has_service_area");
  } catch { /* non-critical */ }

  revalidatePath("/dashboard/service-areas");
  revalidatePath("/");
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

  const { data: saUpdateMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(saUpdateMembership?.role ?? "")) {
    return { ok: false, message: "Only dispatchers and above can manage service areas." };
  }

  const postalCodes = buildPostalCodes(
    parsed.data.primaryPostalCode,
    parsed.data.postalCodesInput
  );

  // Same overlap guard as create — but exclude the area we're editing
  // so a no-op save (or a rename without ZIP changes) doesn't flag its
  // own ZIPs as duplicates.
  const conflict = await findOverlappingArea(
    supabase,
    ctx.organizationId,
    postalCodes,
    parsed.data.serviceAreaId,
  );
  if (conflict) {
    return {
      ok: false,
      message: `ZIP ${conflict.overlap.join(", ")} is already covered by "${conflict.label}". Move it there or remove it from this area before saving.`,
    };
  }

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
  revalidatePath("/");
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

  const { data: saArchiveMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(saArchiveMembership?.role ?? "")) {
    return { ok: false, message: "Only dispatchers and above can manage service areas." };
  }

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
  revalidatePath("/");
  return { ok: true, message: "Service area archived." };
}

"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type MaintenanceActionState = { ok: boolean; message: string };

export async function logMaintenance(
  _prev: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: maintenance record would be created." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const productId = String(formData.get("product_id") ?? "").trim();
  const maintenanceType = String(formData.get("maintenance_type") ?? "service").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const costRaw = parseFloat(String(formData.get("cost_amount") ?? "0")) || 0;

  if (!productId) return { ok: false, message: "Select a product." };

  const VALID_MAINTENANCE_TYPES = ["service", "repair", "inspection", "cleaning", "other"];
  if (!VALID_MAINTENANCE_TYPES.includes(maintenanceType)) {
    return { ok: false, message: "Invalid maintenance type." };
  }
  if (notes.length > 2000) {
    return { ok: false, message: "Notes must be 2000 characters or fewer." };
  }
  if (costRaw < 0 || costRaw > 1_000_000) {
    return { ok: false, message: "Cost must be between 0 and 1,000,000." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: logMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(logMembership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to log maintenance." };
  }

  // Verify product belongs to this org
  const { data: product } = await supabase
    .from("products")
    .select("id, name, slug")
    .eq("id", productId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!product) return { ok: false, message: "Product not found." };

  // Find or auto-create an asset for this product
  let assetId: string;
  const { data: existingAsset } = await supabase
    .from("assets")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("product_id", productId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingAsset) {
    assetId = existingAsset.id;
  } else {
    const { data: newAsset, error: assetError } = await supabase
      .from("assets")
      .insert({
        organization_id: ctx.organizationId,
        product_id: productId,
        asset_tag: product.slug ?? product.name.toLowerCase().replace(/\s+/g, "-"),
        condition_status: "good",
        operational_status: "ready",
      })
      .select("id")
      .single();

    if (assetError || !newAsset) {
      return { ok: false, message: assetError?.message ?? "Failed to create asset." };
    }
    assetId = newAsset.id;
  }

  const { error } = await supabase.from("maintenance_records").insert({
    organization_id: ctx.organizationId,
    asset_id: assetId,
    maintenance_type: maintenanceType,
    status: "open",
    notes: notes || null,
    cost_amount: costRaw,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/maintenance");
  return { ok: true, message: "Maintenance record created." };
}

export async function updateMaintenanceStatus(
  _prev: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const recordId = String(formData.get("record_id") ?? "").trim();
  const newStatus = String(formData.get("status") ?? "").trim();

  if (!recordId || !newStatus) return { ok: false, message: "Missing fields." };

  const VALID_MAINTENANCE_STATUSES = ["open", "in_progress", "resolved"];
  if (!VALID_MAINTENANCE_STATUSES.includes(newStatus)) {
    return { ok: false, message: "Invalid status." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: statusMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(statusMembership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to update maintenance status." };
  }

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (newStatus === "resolved") {
    updatePayload.completed_at = new Date().toISOString();
  }
  // Don't clear completed_at on re-open — preserve the historical timestamp.

  const { error } = await supabase
    .from("maintenance_records")
    .update(updatePayload)
    .eq("id", recordId)
    .eq("organization_id", ctx.organizationId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/maintenance");
  return { ok: true, message: `Marked as ${newStatus}.` };
}

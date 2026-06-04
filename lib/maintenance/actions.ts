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
  // Parse the cost explicitly: `parseFloat("abc") || 0` silently zeroes
  // out typos, and a blank field should remain 0 only if the user truly
  // submitted nothing. Reject non-numeric or non-finite (NaN, Infinity)
  // input with a clear message.
  const costInput = String(formData.get("cost_amount") ?? "").trim();
  const costRaw = costInput === "" ? 0 : parseFloat(costInput);
  if (!Number.isFinite(costRaw)) {
    return { ok: false, message: "Cost must be a valid number." };
  }

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
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingAsset) {
    assetId = existingAsset.id;
  } else {
    // Derive a human-readable asset tag, then append a 6-char id suffix to
    // avoid collisions when two products in the same org share a slug or
    // name (the UUID asset.id is the real key — the tag is cosmetic). The
    // suffix uses the cryptographically random asset id once we have one,
    // but we don't have it yet here, so we generate a short random suffix
    // up front. Math.random is fine for human-readable disambiguation.
    const baseTag = product.slug ?? product.name.toLowerCase().replace(/\s+/g, "-");
    const suffix = Math.random().toString(36).slice(2, 8);
    const { data: newAsset, error: assetError } = await supabase
      .from("assets")
      .insert({
        organization_id: ctx.organizationId,
        product_id: productId,
        asset_tag: `${baseTag}-${suffix}`,
        condition_status: "good",
        operational_status: "ready",
      })
      .select("id")
      .single();

    if (assetError || !newAsset) {
      if (assetError) console.error("[maintenance] auto-create asset failed:", assetError.message);
      return { ok: false, message: "Failed to create the asset record." };
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

  if (error) {
    console.error("[maintenance] log insert failed:", error.message);
    return { ok: false, message: "Couldn't save the maintenance record." };
  }

  // Re-audit follow-up — when an asset goes into maintenance, scan the
  // confirmed/scheduled orders that already reserved the affected
  // product so the operator isn't surprised by an unfulfillable booking
  // at delivery time. Count + first-N order numbers come back in the
  // success message; full handling (reassign / cancel) stays manual for
  // now since the right action depends on context.
  let warningSuffix = "";
  try {
    const { data: affected } = await supabase
      .from("availability_blocks")
      .select("source_order_id, orders!inner(order_number, order_status)")
      .eq("organization_id", ctx.organizationId)
      .eq("product_id", productId)
      .gt("ends_at", new Date().toISOString())
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
      .limit(20);
    const open = (affected ?? []).filter((b) => {
      const o = (b as { orders?: { order_status?: string } | null }).orders;
      const s = o?.order_status ?? "";
      return !["cancelled", "refunded", "completed"].includes(s);
    });
    if (open.length > 0) {
      const sample = open
        .slice(0, 3)
        .map((b) => {
          const o = (b as { orders?: { order_number?: string } | null }).orders;
          return o?.order_number ?? "?";
        })
        .join(", ");
      warningSuffix = ` Heads up — ${open.length} confirmed order(s) already reserved this item (${sample}${open.length > 3 ? "…" : ""}). Review or reassign before the event date.`;
    }
  } catch {
    // Non-fatal — operator still gets the maintenance record.
  }

  revalidatePath("/dashboard/maintenance");
  // #372 maintenance writes can flip asset operational_status, which affects
  // product detail visibility and storefront availability.
  revalidatePath("/dashboard/products", "layout");
  revalidatePath("/inventory", "layout");
  return { ok: true, message: `Maintenance record created.${warningSuffix}` };
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

  if (error) {
    console.error("[maintenance] updateStatus failed:", error.message);
    return { ok: false, message: "Couldn't update the maintenance status." };
  }

  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/products", "layout");
  revalidatePath("/inventory", "layout");
  return { ok: true, message: `Marked as ${newStatus}.` };
}

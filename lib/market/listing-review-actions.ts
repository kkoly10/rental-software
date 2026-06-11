"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Listing moderation queue actions (§19 queue #1). Platform-admin
 * only — same gate as dispute resolution.
 */

function isPlatformAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

async function requireAdmin(): Promise<boolean> {
  if (!hasSupabaseEnv()) return false;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user && isPlatformAdmin(user.email));
}

export async function approveListing(formData: FormData): Promise<void> {
  const listingId = String(formData.get("listing_id") ?? "");
  if (!z.string().uuid().safeParse(listingId).success) return;
  if (!(await requireAdmin())) return;

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  await admin
    .from("market_listings")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .eq("status", "pending_review");
  revalidatePath("/dashboard/market-admin");
}

export async function rejectListing(formData: FormData): Promise<void> {
  const listingId = String(formData.get("listing_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!z.string().uuid().safeParse(listingId).success || !reason) return;
  if (!(await requireAdmin())) return;

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  await admin
    .from("market_listings")
    .update({
      status: "rejected",
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .eq("status", "pending_review");
  revalidatePath("/dashboard/market-admin");
}

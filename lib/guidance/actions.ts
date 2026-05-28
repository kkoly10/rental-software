"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getCurrentUserId(): Promise<string | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export type GuidanceState = {
  hasSeenWelcome: boolean;
  hasCompletedTour: boolean;
  dismissedHelp: Record<string, boolean>;
  dismissedChecklist: boolean;
  dismissedMilestones: string[];
  tourVersion: string;
};

const defaultState: GuidanceState = {
  hasSeenWelcome: false,
  hasCompletedTour: false,
  dismissedHelp: {},
  dismissedChecklist: false,
  dismissedMilestones: [],
  tourVersion: "v1",
};

export async function getGuidanceState(): Promise<GuidanceState> {
  const userId = await getCurrentUserId();
  if (!userId) return defaultState;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_guidance_state")
    .select("*")
    .eq("profile_id", userId)
    .maybeSingle();

  if (!data) return defaultState;

  return {
    hasSeenWelcome: data.has_seen_welcome ?? false,
    hasCompletedTour: data.has_completed_tour ?? false,
    dismissedHelp: (data.dismissed_help as Record<string, boolean>) ?? {},
    dismissedChecklist: data.dismissed_checklist ?? false,
    dismissedMilestones: (data.dismissed_milestones as string[]) ?? [],
    tourVersion: data.tour_version ?? "v1",
  };
}

async function upsertGuidance(updates: Record<string, unknown>) {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("user_guidance_state")
    .upsert({ profile_id: userId, ...updates }, { onConflict: "profile_id" });
}

export async function markWelcomeSeen() {
  await upsertGuidance({ has_seen_welcome: true });
  revalidatePath("/dashboard");
}

export async function markTourCompleted() {
  await upsertGuidance({ has_completed_tour: true });
  revalidatePath("/dashboard");
}

const VALID_HELP_BANNER_KEYS = new Set([
  "getting-started",
  "invite-team",
  "add-vehicle",
  "add-customer",
  "create-booking",
  "setup-payments",
  "explore-reports",
]);

export async function dismissHelpBanner(key: string) {
  if (typeof key !== "string" || key.length > 50 || !VALID_HELP_BANNER_KEYS.has(key)) {
    return;
  }
  const state = await getGuidanceState();
  const dismissed = { ...state.dismissedHelp, [key]: true };
  await upsertGuidance({ dismissed_help: dismissed });
  revalidatePath("/dashboard");
}

export async function dismissChecklist() {
  await upsertGuidance({ dismissed_checklist: true });
  revalidatePath("/dashboard");
}

export async function resetTour() {
  await upsertGuidance({ has_completed_tour: false });
  revalidatePath("/dashboard");
}

const VALID_MILESTONE_KEYS = new Set([
  "first_product",
  "first_order",
  "first_payment",
  "first_delivery",
  "setup_complete",
  "ten_orders",
]);

export async function dismissMilestone(key: string) {
  if (typeof key !== "string" || key.length > 50 || !VALID_MILESTONE_KEYS.has(key)) {
    return;
  }
  const state = await getGuidanceState();
  // Dedup so re-dismissing the same milestone (or a double-fire) doesn't bloat
  // the array.
  if (state.dismissedMilestones.includes(key)) {
    return;
  }
  const milestones = [...state.dismissedMilestones, key];
  await upsertGuidance({ dismissed_milestones: milestones });
  revalidatePath("/dashboard");
}

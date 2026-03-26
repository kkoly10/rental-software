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
  tourVersion: string;
};

const defaultState: GuidanceState = {
  hasSeenWelcome: false,
  hasCompletedTour: false,
  dismissedHelp: {},
  dismissedChecklist: false,
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
    tourVersion: data.tour_version ?? "v1",
  };
}

async function upsertGuidance(updates: Record<string, unknown>) {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const supabase = await createSupabaseServerClient();

  // Try update first, then insert if no row exists
  const { data: existing } = await supabase
    .from("user_guidance_state")
    .select("profile_id")
    .eq("profile_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("user_guidance_state")
      .update(updates)
      .eq("profile_id", userId);
  } else {
    await supabase
      .from("user_guidance_state")
      .insert({ profile_id: userId, ...updates });
  }
}

export async function markWelcomeSeen() {
  await upsertGuidance({ has_seen_welcome: true });
  revalidatePath("/dashboard");
}

export async function markTourCompleted() {
  await upsertGuidance({ has_completed_tour: true });
  revalidatePath("/dashboard");
}

export async function dismissHelpBanner(key: string) {
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

"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type StopActionState = {
  ok: boolean;
  message: string;
};

export async function updateStopStatus(
  stopId: string,
  newStatus: string
): Promise<StopActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo mode: Stop would be marked ${newStatus}.` };
  }

  const supabase = await createSupabaseServerClient();

  const updateData: Record<string, unknown> = { stop_status: newStatus };
  if (newStatus === "completed") {
    updateData.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("route_stops")
    .update(updateData)
    .eq("id", stopId);

  if (error) {
    return { ok: false, message: error.message };
  }

  // If stop is completed, check if all stops on route are done → update route status
  if (newStatus === "completed") {
    const { data: stop } = await supabase
      .from("route_stops")
      .select("route_id")
      .eq("id", stopId)
      .maybeSingle();

    if (stop?.route_id) {
      const { data: remaining } = await supabase
        .from("route_stops")
        .select("id")
        .eq("route_id", stop.route_id)
        .neq("stop_status", "completed");

      if (remaining && remaining.length === 0) {
        await supabase
          .from("routes")
          .update({ route_status: "completed" })
          .eq("id", stop.route_id);
      }
    }
  }

  // If stop is en_route or in_progress, set route to in_progress
  if (newStatus === "en_route" || newStatus === "in_progress") {
    const { data: stop } = await supabase
      .from("route_stops")
      .select("route_id")
      .eq("id", stopId)
      .maybeSingle();

    if (stop?.route_id) {
      await supabase
        .from("routes")
        .update({ route_status: "in_progress" })
        .eq("id", stop.route_id);
    }
  }

  revalidatePath("/crew/today");
  revalidatePath("/dashboard/deliveries");

  return { ok: true, message: `Stop marked as ${newStatus.replace(/_/g, " ")}.` };
}

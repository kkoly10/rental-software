import "server-only";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type OrderSeriesSummary = {
  seriesId: string;
  occurrenceNumber: number | null;
  frequency: string;
  intervalCount: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  maxOccurrences: number | null;
  lastGeneratedThrough: string | null;
};

/**
 * Sprint 3 — fetch the recurring-series summary for a given order, if
 * any. Returns null for one-off orders so the order detail page can
 * render the "Make recurring" CTA instead of the series card.
 */
export async function getOrderSeriesSummary(
  orderId: string,
): Promise<OrderSeriesSummary | null> {
  if (!hasSupabaseEnv()) return null;
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select("order_series_id, series_occurrence_number")
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  const seriesId = order?.order_series_id as string | null | undefined;
  if (!seriesId) return null;

  const { data: series } = await supabase
    .from("order_series")
    .select(
      "id, frequency, interval_count, status, start_date, end_date, max_occurrences, last_generated_through",
    )
    .eq("id", seriesId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!series) return null;

  return {
    seriesId: series.id as string,
    occurrenceNumber: (order?.series_occurrence_number as number | null) ?? null,
    frequency: series.frequency as string,
    intervalCount: Number(series.interval_count ?? 1),
    status: series.status as string,
    startDate: (series.start_date as string | null) ?? null,
    endDate: (series.end_date as string | null) ?? null,
    maxOccurrences: (series.max_occurrences as number | null) ?? null,
    lastGeneratedThrough: (series.last_generated_through as string | null) ?? null,
  };
}

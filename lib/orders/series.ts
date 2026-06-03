"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  defaultExpansionHorizon,
  enumerateOccurrences,
  type SeriesCadence,
  type SeriesFrequency,
} from "./series-cadence";

/**
 * Recurring booking series actions (Sprint 3).
 *
 * Lifecycle:
 *
 *   1. Operator clicks "Make recurring" on a template order.
 *      `createSeriesFromOrder` records the series, back-points the
 *      template order at it (occurrence #1), and eagerly generates
 *      child orders up to the default horizon (~2 years out, capped
 *      by batch).
 *   2. `expandSeries` runs every day from a cron (Sprint 3.5) to push
 *      the horizon forward when an indefinite series has been running
 *      for a while.
 *   3. `cancelSeries` stops future generation. Operator picks whether
 *      pending child orders (`status` in inquiry / quote_sent /
 *      awaiting_deposit / confirmed) should also be cancelled.
 *   4. `pauseSeries` / `resumeSeries` toggle generation without
 *      touching existing children. Useful for vacations or seasonal
 *      pauses where the operator wants to keep the series alive but
 *      not generate new orders for a while.
 */

export type SeriesActionState = {
  ok: boolean;
  message: string;
  seriesId?: string;
  generated?: number;
};

export type CreateSeriesInput = {
  templateOrderId: string;
  frequency: SeriesFrequency;
  intervalCount: number;
  endDate?: string | null;
  maxOccurrences?: number | null;
};

async function requireDispatcher(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, organizationId: string, userId: string): Promise<string | null> {
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const role = membership?.role as string | undefined;
  if (!role || !["owner", "admin", "dispatcher"].includes(role)) {
    return null;
  }
  return role;
}

/**
 * Turn an existing order into the template for a recurring series.
 * The template stays as occurrence #1; child orders are generated for
 * subsequent dates.
 */
export async function createSeriesFromOrder(
  _prev: SeriesActionState,
  formData: FormData,
): Promise<SeriesActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: series would be created." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const input = parseCreateInput(formData);
  if (!input.ok) return { ok: false, message: input.message };

  const supabase = await createSupabaseServerClient();
  const role = await requireDispatcher(supabase, ctx.organizationId, ctx.userId);
  if (!role) {
    return { ok: false, message: "Only dispatchers and above can manage recurring bookings." };
  }

  // 1. Load the template order — verify it exists in this org and is
  //    not already part of a series.
  const { data: template } = await supabase
    .from("orders")
    .select(
      "id, customer_id, event_date, delivery_address_id, subtotal_amount, delivery_fee_amount, deposit_due_amount, total_amount, order_series_id",
    )
    .eq("id", input.value.templateOrderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!template) {
    return { ok: false, message: "Template order not found." };
  }
  if (template.order_series_id) {
    return {
      ok: false,
      message: "This order is already part of a recurring series.",
    };
  }
  if (!template.event_date) {
    return {
      ok: false,
      message: "Template order needs an event date before it can recur.",
    };
  }

  // 2. Create the series row.
  const { data: series, error: seriesErr } = await supabase
    .from("order_series")
    .insert({
      organization_id: ctx.organizationId,
      customer_id: template.customer_id,
      template_order_id: template.id,
      frequency: input.value.frequency,
      interval_count: input.value.intervalCount,
      start_date: template.event_date,
      end_date: input.value.endDate ?? null,
      max_occurrences: input.value.maxOccurrences ?? null,
      status: "active",
      created_by_profile_id: ctx.userId,
    })
    .select("id")
    .single();

  if (seriesErr || !series) {
    return { ok: false, message: seriesErr?.message ?? "Failed to create series." };
  }

  // 3. Back-point the template order at the series. It's occurrence #1.
  const { error: templateUpdateErr } = await supabase
    .from("orders")
    .update({
      order_series_id: series.id,
      series_occurrence_number: 1,
    })
    .eq("id", template.id)
    .eq("organization_id", ctx.organizationId);

  if (templateUpdateErr) {
    // Best-effort rollback so we don't leave a half-built series. We
    // can't transactionally bracket these via supabase-js, but
    // deleting the series here keeps the state consistent for the
    // next try.
    await supabase.from("order_series").delete().eq("id", series.id);
    return { ok: false, message: templateUpdateErr.message };
  }

  // 4. Eagerly expand. Generates child orders for the rest of the
  //    default horizon. The cron picks up the rest later.
  const expansion = await expandSeriesInternal(supabase, ctx.organizationId, series.id);

  revalidatePath(`/dashboard/orders/${template.id}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/calendar");

  return {
    ok: true,
    message: `Recurring series created. Generated ${expansion.generated} future bookings.`,
    seriesId: series.id,
    generated: expansion.generated,
  };
}

/**
 * Generate the missing child orders for a series up to the default
 * horizon. Idempotent — re-calling on an already-fully-expanded
 * series is a no-op. Used by both the create flow and the daily cron.
 */
export async function expandSeriesInternal(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  seriesId: string,
): Promise<{ generated: number; reachedTerminus: boolean }> {
  const { data: series } = await supabase
    .from("order_series")
    .select(
      "id, customer_id, template_order_id, frequency, interval_count, start_date, end_date, max_occurrences, status, last_generated_through",
    )
    .eq("id", seriesId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!series || series.status !== "active") {
    return { generated: 0, reachedTerminus: true };
  }

  const cadence: SeriesCadence = {
    frequency: series.frequency as SeriesFrequency,
    intervalCount: Number(series.interval_count ?? 1),
  };

  const horizon = defaultExpansionHorizon(new Date());

  const enumeration = enumerateOccurrences({
    startDate: series.start_date as string,
    endDate: (series.end_date as string | null) ?? null,
    maxOccurrences: (series.max_occurrences as number | null) ?? null,
    cadence,
    alreadyGeneratedThrough: (series.last_generated_through as string | null) ?? null,
    through: horizon,
  });

  if (enumeration.occurrences.length === 0) {
    // If the series has fully reached its terminus, mark it completed.
    if (enumeration.reachedTerminus) {
      await supabase
        .from("order_series")
        .update({ status: "completed" })
        .eq("id", seriesId)
        .eq("organization_id", organizationId);
    }
    return { generated: 0, reachedTerminus: enumeration.reachedTerminus };
  }

  // Load the template's items + financials once and reuse for every
  // child order. Single round-trip avoids fanning out N+1 queries.
  if (!series.template_order_id) {
    return { generated: 0, reachedTerminus: false };
  }

  const { data: template } = await supabase
    .from("orders")
    .select(
      "subtotal_amount, delivery_fee_amount, deposit_due_amount, total_amount, delivery_address_id, order_items(item_name_snapshot, quantity, unit_price, line_total, product_id)",
    )
    .eq("id", series.template_order_id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!template) {
    return { generated: 0, reachedTerminus: false };
  }

  let generated = 0;
  let lastDate: string | null = null;

  for (const occurrence of enumeration.occurrences) {
    // Generate an order_number that's unique enough for the child.
    // The existing order-number generator runs server-side via the
    // table default; we can rely on it by inserting without an
    // explicit value.
    const { data: childOrder, error: childErr } = await supabase
      .from("orders")
      .insert({
        organization_id: organizationId,
        customer_id: series.customer_id,
        delivery_address_id: template.delivery_address_id,
        event_date: occurrence.eventDate,
        order_status: "confirmed",
        subtotal_amount: template.subtotal_amount,
        delivery_fee_amount: template.delivery_fee_amount,
        deposit_due_amount: template.deposit_due_amount,
        total_amount: template.total_amount,
        balance_due_amount: template.total_amount,
        order_series_id: seriesId,
        series_occurrence_number: occurrence.occurrenceNumber,
      })
      .select("id")
      .single();

    if (childErr || !childOrder) {
      // Stop at the first failure so we can record the partial
      // progress and let the cron pick up next time.
      break;
    }

    // Copy line items.
    const items = ((template.order_items as unknown) as
      | { item_name_snapshot: string | null; quantity: number | null; unit_price: number | null; line_total: number | null; product_id: string | null }[]
      | null) ?? [];

    if (items.length > 0) {
      const { error: itemsErr } = await supabase.from("order_items").insert(
        items.map((item) => ({
          order_id: childOrder.id,
          product_id: item.product_id,
          item_name_snapshot: item.item_name_snapshot,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        })),
      );
      if (itemsErr) {
        // Item copy failure: delete the partial child so re-expansion
        // produces a clean copy.
        await supabase.from("orders").delete().eq("id", childOrder.id);
        break;
      }
    }

    generated += 1;
    lastDate = occurrence.eventDate;
  }

  if (lastDate) {
    await supabase
      .from("order_series")
      .update({ last_generated_through: lastDate })
      .eq("id", seriesId)
      .eq("organization_id", organizationId);
  }

  if (enumeration.reachedTerminus && generated === enumeration.occurrences.length) {
    await supabase
      .from("order_series")
      .update({ status: "completed" })
      .eq("id", seriesId)
      .eq("organization_id", organizationId);
  }

  return { generated, reachedTerminus: enumeration.reachedTerminus };
}

/**
 * Cancel a series. Future child orders that are still in a cancellable
 * state (inquiry / quote_sent / awaiting_deposit / confirmed) can be
 * optionally cancelled too. Past orders are always left alone — they
 * happened and the bookkeeping shouldn't change retroactively.
 */
export async function cancelSeries(
  _prev: SeriesActionState,
  formData: FormData,
): Promise<SeriesActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: series would be cancelled." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const seriesId = String(formData.get("series_id") ?? "");
  const cancelFuture = String(formData.get("cancel_future") ?? "false") === "true";
  if (!seriesId) return { ok: false, message: "Missing series id." };

  const supabase = await createSupabaseServerClient();
  const role = await requireDispatcher(supabase, ctx.organizationId, ctx.userId);
  if (!role) {
    return { ok: false, message: "Only dispatchers and above can manage recurring bookings." };
  }

  const { error: seriesErr } = await supabase
    .from("order_series")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by_profile_id: ctx.userId,
    })
    .eq("id", seriesId)
    .eq("organization_id", ctx.organizationId);
  if (seriesErr) return { ok: false, message: seriesErr.message };

  let cancelledChildren = 0;
  if (cancelFuture) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: children } = await supabase
      .from("orders")
      .select("id, order_status, event_date")
      .eq("organization_id", ctx.organizationId)
      .eq("order_series_id", seriesId)
      .gte("event_date", today)
      .in("order_status", ["inquiry", "quote_sent", "awaiting_deposit", "confirmed"])
      .is("deleted_at", null);

    // Mirror the cleanup chain that updateOrderStatus runs on a single
    // cancellation: flip the status AND tear down any route stop the
    // child had attached. Without this, a future child that was already
    // bundled into a planned route would leave a zombie stop after the
    // series cancels, and the driver would still see "Customer X — pickup"
    // on their day's run.
    const { removeOrderStopOnCancel } = await import(
      "@/lib/routes/remove-stop-on-cancel"
    );
    for (const child of children ?? []) {
      const { error } = await supabase
        .from("orders")
        .update({ order_status: "cancelled" })
        .eq("id", child.id)
        .eq("organization_id", ctx.organizationId)
        .is("deleted_at", null);
      if (error) continue;
      cancelledChildren += 1;
      // Swallow stop-removal failures: the order is already cancelled,
      // and the dispatcher gets a clearer signal from app_error_logs if
      // the RPC failed (logged inside removeOrderStopOnCancel) than from
      // an aborted series-cancel that's half done.
      try {
        await removeOrderStopOnCancel(
          ctx.organizationId,
          child.id,
          supabase,
        );
      } catch {
        // logged downstream
      }
    }
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/calendar");

  return {
    ok: true,
    message: cancelFuture
      ? `Series cancelled. ${cancelledChildren} future booking${cancelledChildren === 1 ? "" : "s"} also cancelled.`
      : "Series cancelled. Existing future bookings preserved.",
    seriesId,
  };
}

/**
 * Pause / resume a series. Paused series stop expanding new children
 * but keep their existing children intact. Resume kicks expansion
 * back into gear.
 */
export async function setSeriesStatus(
  _prev: SeriesActionState,
  formData: FormData,
): Promise<SeriesActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: series status would be updated." };
  }
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const seriesId = String(formData.get("series_id") ?? "");
  const next = String(formData.get("status") ?? "");
  if (!["active", "paused"].includes(next)) {
    return { ok: false, message: "Invalid series status." };
  }
  if (!seriesId) return { ok: false, message: "Missing series id." };

  const supabase = await createSupabaseServerClient();
  const role = await requireDispatcher(supabase, ctx.organizationId, ctx.userId);
  if (!role) {
    return { ok: false, message: "Only dispatchers and above can manage recurring bookings." };
  }

  const { error } = await supabase
    .from("order_series")
    .update({ status: next })
    .eq("id", seriesId)
    .eq("organization_id", ctx.organizationId)
    .in("status", ["active", "paused"]); // can't un-cancel from this surface
  if (error) return { ok: false, message: error.message };

  if (next === "active") {
    await expandSeriesInternal(supabase, ctx.organizationId, seriesId);
  }

  revalidatePath("/dashboard/orders");
  return {
    ok: true,
    message: next === "active" ? "Series resumed." : "Series paused.",
    seriesId,
  };
}

function parseCreateInput(
  formData: FormData,
): { ok: true; value: CreateSeriesInput } | { ok: false; message: string } {
  const templateOrderId = String(formData.get("template_order_id") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "").trim();
  const intervalCountRaw = String(formData.get("interval_count") ?? "1").trim();
  const endDate = String(formData.get("end_date") ?? "").trim() || null;
  const maxOccurrencesRaw = String(formData.get("max_occurrences") ?? "").trim() || null;

  if (!templateOrderId) return { ok: false, message: "Missing template order." };

  const VALID_FREQUENCIES: SeriesFrequency[] = [
    "daily",
    "weekly",
    "biweekly",
    "monthly",
    "quarterly",
  ];
  if (!VALID_FREQUENCIES.includes(frequency as SeriesFrequency)) {
    return { ok: false, message: "Pick a cadence." };
  }

  const intervalCount = Number.parseInt(intervalCountRaw, 10);
  if (!Number.isFinite(intervalCount) || intervalCount < 1 || intervalCount > 52) {
    return { ok: false, message: "Interval must be between 1 and 52." };
  }

  let maxOccurrences: number | null = null;
  if (maxOccurrencesRaw) {
    const parsed = Number.parseInt(maxOccurrencesRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 2 || parsed > 1000) {
      return { ok: false, message: "Max occurrences must be between 2 and 1000." };
    }
    maxOccurrences = parsed;
  }

  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, message: "End date must be a valid date." };
  }

  return {
    ok: true,
    value: {
      templateOrderId,
      frequency: frequency as SeriesFrequency,
      intervalCount,
      endDate,
      maxOccurrences,
    },
  };
}

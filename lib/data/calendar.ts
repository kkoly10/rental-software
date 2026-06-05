import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  // "order" — plotted by event_date (when the customer's event happens)
  // "delivery" — plotted by route_date (when the truck leaves) — decision 4.1
  // "block" — availability block / manual hold
  type: "order" | "delivery" | "block";
  tone: "default" | "success" | "warning" | "danger";
};

export type CalendarView = "events" | "deliveries" | "both";

export async function getCalendarEvents(
  year: number,
  month: number,
  view: CalendarView = "events"
): Promise<CalendarEvent[]> {
  if (!hasSupabaseEnv()) return [];

  const ctx = await getOrgContext();
  if (!ctx) return [];

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const supabase = await createSupabaseServerClient();

  const includeOrders = view === "events" || view === "both";
  const includeDeliveries = view === "deliveries" || view === "both";

  const [ordersResult, blocksResult, routesResult] = await Promise.all([
    includeOrders
      ? supabase
          .from("orders")
          .select(
            "id, order_number, event_date, order_status, customers(first_name, last_name)"
          )
          .eq("organization_id", ctx.organizationId)
          .is("deleted_at", null)
          .gte("event_date", startDate)
          .lt("event_date", endDate)
          .neq("order_status", "cancelled")
          .order("event_date")
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    supabase
      .from("availability_blocks")
      .select("id, starts_at, ends_at, block_type, reason, expires_at, products(name)")
      .eq("organization_id", ctx.organizationId)
      // Capture blocks that overlap the calendar period (not just those starting within it)
      .lt("starts_at", endDate)
      .gte("ends_at", startDate)
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
      .order("starts_at"),
    includeDeliveries
      ? supabase
          .from("routes")
          .select(
            "id, name, route_date, route_status, route_stops(id, orders(id, order_number, customers(first_name, last_name)))"
          )
          .eq("organization_id", ctx.organizationId)
          .gte("route_date", startDate)
          .lt("route_date", endDate)
          .neq("route_status", "cancelled")
          .order("route_date")
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const events: CalendarEvent[] = [];

  // De-duplicate when view === "both" — an order that's already been
  // routed will appear as both an "order" event (plotted by event_date)
  // and a "delivery" event (plotted by route_date). We render only the
  // delivery row in that case so the operator can click straight to the
  // route they actually need to dispatch.
  const routedOrderIds = new Set<string>();
  if (view === "both" && routesResult.data) {
    for (const r of routesResult.data as Array<{
      route_stops?: { orders?: { id?: string } | null }[] | null;
    }>) {
      const stops = r.route_stops ?? [];
      for (const stop of stops) {
        const id = stop?.orders?.id;
        if (typeof id === "string") routedOrderIds.add(id);
      }
    }
  }

  if (ordersResult.data) {
    for (const o of ordersResult.data) {
      if (view === "both" && routedOrderIds.has(o.id)) continue;
      const c = (o as Record<string, unknown>).customers as
        | { first_name?: string | null; last_name?: string | null }
        | null;
      const name = c
        ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
        : o.order_number ?? "Order";
      const status = o.order_status ?? "inquiry";

      events.push({
        id: o.id,
        date: o.event_date ?? "",
        label: name,
        type: "order",
        tone:
          status === "confirmed" || status === "completed" || status === "delivered"
            ? "success"
            : status === "awaiting_deposit" || status === "quote_sent"
            ? "warning"
            : "default",
      });
    }
  }

  if (blocksResult.data) {
    // Follow-up #16 — multi-day blocks used to render a single marker
    // pinned to the first day of the visible month, so a block that
    // covered Apr 28 → May 5 viewed in May only showed a "hold" pip on
    // May 1. Operators saw 1 day blocked when 5 were. Now we expand
    // the block into per-day markers across [starts_at, ends_at),
    // clamped to the visible month, and capped at the month's day
    // count (so a year-long block doesn't render 365 markers — the
    // cap is naturally the month length since we only render days the
    // user can see).
    const monthEndExclusive = endDate; // YYYY-MM-01 of the next month
    for (const b of blocksResult.data) {
      const product = (b as Record<string, unknown>).products as
        | { name?: string | null }
        | null;
      const label = `${product?.name ?? "Product"} — ${b.reason ?? b.block_type ?? "Hold"}`;
      const blockStartDate = b.starts_at ? b.starts_at.slice(0, 10) : "";
      // ends_at on availability_blocks is exclusive — a block for
      // "Apr 28 only" stores ends_at = Apr 29 00:00. The minus-one
      // gives us the last *day* the block actually occupies.
      const blockEndExclusive = b.ends_at ? b.ends_at.slice(0, 10) : "";
      if (!blockStartDate || !blockEndExclusive) continue;

      const spanStart = blockStartDate < startDate ? startDate : blockStartDate;
      const spanEnd =
        blockEndExclusive > monthEndExclusive ? monthEndExclusive : blockEndExclusive;
      if (spanStart >= spanEnd) {
        // The block ends at midnight of spanStart — still surface a
        // single pip on that day so a same-day block doesn't vanish.
        events.push({ id: b.id, date: spanStart, label, type: "block", tone: "danger" });
        continue;
      }

      // Walk day-by-day. Anchored in UTC so the iteration doesn't drift
      // on DST boundaries.
      const cursor = new Date(spanStart + "T00:00:00Z");
      const stop = new Date(spanEnd + "T00:00:00Z");
      let dayIndex = 0;
      while (cursor < stop && dayIndex < 31) {
        const isoDay = cursor.toISOString().slice(0, 10);
        events.push({
          id: `${b.id}:${isoDay}`,
          date: isoDay,
          label,
          type: "block",
          tone: "danger",
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        dayIndex += 1;
      }
    }
  }

  // Delivery events (decision 4.1) — one card per route per route_date,
  // showing the route name and the stop count. Operators planning by truck
  // departure (rather than customer event date) now have a calendar.
  const routesData = (routesResult as { data?: unknown[] }).data ?? [];
  if (Array.isArray(routesData)) {
    for (const r of routesData) {
      const route = r as {
        id: string;
        name?: string | null;
        route_date?: string | null;
        route_status?: string | null;
        route_stops?: { id: string }[] | null;
      };
      if (!route.route_date) continue;
      const stopCount = Array.isArray(route.route_stops)
        ? route.route_stops.length
        : 0;
      // Re-audit follow-up #3a: skip 0-stop routes so the calendar
      // doesn't get cluttered with empty placeholder routes an
      // operator pre-created but never populated.
      if (stopCount === 0) continue;
      const status = route.route_status ?? "planned";
      events.push({
        id: `route:${route.id}`,
        date: route.route_date,
        label: `🚚 ${route.name ?? "Route"} (${stopCount})`,
        type: "delivery",
        tone:
          status === "completed"
            ? "success"
            : status === "in_progress"
            ? "warning"
            : "default",
      });
    }
  }

  return events;
}

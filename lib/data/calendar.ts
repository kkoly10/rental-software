import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  type: "order" | "block";
  tone: "default" | "success" | "warning" | "danger";
};

export async function getCalendarEvents(
  year: number,
  month: number
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

  const [ordersResult, blocksResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, event_date, order_status, customers(first_name, last_name)"
      )
      .eq("organization_id", ctx.organizationId)
      .gte("event_date", startDate)
      .lt("event_date", endDate)
      .neq("order_status", "cancelled")
      .order("event_date"),
    supabase
      .from("availability_blocks")
      .select("id, starts_at, block_type, reason, products(name)")
      .eq("organization_id", ctx.organizationId)
      .gte("starts_at", startDate)
      .lt("starts_at", endDate)
      .order("starts_at"),
  ]);

  const events: CalendarEvent[] = [];

  if (ordersResult.data) {
    for (const o of ordersResult.data) {
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
    for (const b of blocksResult.data) {
      const product = (b as Record<string, unknown>).products as
        | { name?: string | null }
        | null;
      events.push({
        id: b.id,
        date: b.starts_at ? b.starts_at.slice(0, 10) : "",
        label: `${product?.name ?? "Product"} — ${b.reason ?? b.block_type ?? "Hold"}`,
        type: "block",
        tone: "danger",
      });
    }
  }

  return events;
}

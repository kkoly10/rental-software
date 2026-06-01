import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { formatTimeInTimeZone, formatDateInTimeZone } from "@/lib/datetime/event-time";
import { getOrgEventTimezone } from "@/lib/datetime/org-timezone";

export type SmsLogEntry = {
  id: string;
  phone: string;
  preview: string;
  timestamp: string;
  status: "sent" | "failed";
};

function formatTimestamp(iso: string, tz: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) return "just now";
  if (diffHours < 24) {
    return `Today, ${formatTimeInTimeZone(d, tz)}`;
  }
  if (diffHours < 48) {
    return `Yesterday, ${formatTimeInTimeZone(d, tz)}`;
  }
  return (
    formatDateInTimeZone(d, tz, { month: "short", day: "numeric" }) +
    `, ${formatTimeInTimeZone(d, tz)}`
  );
}

export async function getSmsLog(): Promise<SmsLogEntry[]> {
  if (!hasSupabaseEnv()) return [];

  const ctx = await getOrgContext();
  if (!ctx) return [];

  const supabase = await createSupabaseServerClient();
  const [{ data }, tz] = await Promise.all([
    supabase
      .from("communication_log")
      .select("id, recipient, body_preview, status, created_at")
      .eq("organization_id", ctx.organizationId)
      .eq("channel", "sms")
      .order("created_at", { ascending: false })
      .limit(50),
    getOrgEventTimezone(ctx.organizationId),
  ]);

  if (!data || data.length === 0) return [];

  return data.map((row) => ({
    id: row.id,
    phone: row.recipient ?? "",
    preview: row.body_preview ?? "",
    timestamp: formatTimestamp(row.created_at, tz),
    status: row.status === "failed" ? "failed" : "sent",
  }));
}

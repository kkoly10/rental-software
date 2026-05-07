import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type SmsLogEntry = {
  id: string;
  phone: string;
  preview: string;
  timestamp: string;
  status: "sent" | "failed";
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) return "just now";
  if (diffHours < 24) {
    return `Today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  if (diffHours < 48) {
    return `Yesterday, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    `, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export async function getSmsLog(): Promise<SmsLogEntry[]> {
  if (!hasSupabaseEnv()) return [];

  const ctx = await getOrgContext();
  if (!ctx) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("communication_log")
    .select("id, recipient, body_preview, status, created_at")
    .eq("organization_id", ctx.organizationId)
    .eq("channel", "sms")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data || data.length === 0) return [];

  return data.map((row) => ({
    id: row.id,
    phone: row.recipient ?? "",
    preview: row.body_preview ?? "",
    timestamp: formatTimestamp(row.created_at),
    status: row.status === "failed" ? "failed" : "sent",
  }));
}

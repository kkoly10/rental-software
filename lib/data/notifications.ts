import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type NotificationType =
  | "new_order"
  | "payment_received"
  | "order_confirmed"
  | "delivery_scheduled"
  | "new_customer"
  | "low_inventory"
  | "new_message";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return `${Math.floor(diffDay / 7)}w ago`;
}

const demoNotifications: Notification[] = [
  {
    id: "demo-1",
    type: "new_order",
    title: "New order received",
    description: "Castle Combo Bounce House — Sarah Mitchell",
    timestamp: "2h ago",
    read: false,
    link: "/dashboard/orders",
  },
  {
    id: "demo-2",
    type: "payment_received",
    title: "Payment received",
    description: "$425.00 from James Rodriguez",
    timestamp: "3h ago",
    read: false,
    link: "/dashboard/payments",
  },
  {
    id: "demo-3",
    type: "delivery_scheduled",
    title: "Delivery scheduled",
    description: "Order #1042 — Saturday 10:00 AM",
    timestamp: "5h ago",
    read: false,
    link: "/dashboard/deliveries",
  },
  {
    id: "demo-4",
    type: "new_customer",
    title: "New customer signed up",
    description: "Emily Chen created an account",
    timestamp: "8h ago",
    read: true,
  },
  {
    id: "demo-5",
    type: "order_confirmed",
    title: "Order confirmed",
    description: "Order #1039 confirmed by customer",
    timestamp: "12h ago",
    read: true,
    link: "/dashboard/orders",
  },
];

export async function getNotifications(): Promise<Notification[]> {
  if (!hasSupabaseEnv()) {
    return demoNotifications;
  }

  const ctx = await getOrgContext();
  if (!ctx) return demoNotifications;

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, description, link, read, created_at")
      .eq("organization_id", ctx.organizationId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      return demoNotifications;
    }

    return data.map((n) => ({
      id: n.id,
      type: n.type as NotificationType,
      title: n.title,
      description: n.description ?? "",
      timestamp: relativeTime(n.created_at),
      read: n.read,
      link: n.link ?? undefined,
    }));
  } catch {
    return demoNotifications;
  }
}

/**
 * Insert a notification into the database. Designed to be called from
 * server actions / trigger functions. Fails silently.
 */
export async function createNotification(
  organizationId: string,
  type: NotificationType,
  title: string,
  description: string,
  link?: string
): Promise<void> {
  if (!hasSupabaseEnv()) return;

  try {
    const { createSupabaseServerClient: createSB } = await import(
      "@/lib/supabase/server"
    );
    const supabase = await createSB();

    await supabase.from("notifications").insert({
      organization_id: organizationId,
      type,
      title,
      description,
      link: link ?? null,
      read: false,
    });
  } catch {
    // Non-blocking — notification creation should never break a flow
  }
}

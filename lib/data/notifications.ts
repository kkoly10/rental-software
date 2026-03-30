import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NotificationType =
  | "new_order"
  | "payment_received"
  | "order_confirmed"
  | "delivery_scheduled"
  | "new_customer"
  | "low_inventory";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
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
  },
  {
    id: "demo-2",
    type: "payment_received",
    title: "Payment received",
    description: "$425.00 from James Rodriguez",
    timestamp: "3h ago",
    read: false,
  },
  {
    id: "demo-3",
    type: "delivery_scheduled",
    title: "Delivery scheduled",
    description: "Order #1042 — Saturday 10:00 AM",
    timestamp: "5h ago",
    read: false,
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
  },
  {
    id: "demo-6",
    type: "low_inventory",
    title: "Low inventory alert",
    description: "Water Slide Deluxe — only 1 unit available",
    timestamp: "1d ago",
    read: true,
  },
  {
    id: "demo-7",
    type: "payment_received",
    title: "Payment received",
    description: "$310.00 from Michael Torres",
    timestamp: "1d ago",
    read: true,
  },
];

export async function getNotifications(): Promise<Notification[]> {
  if (!hasSupabaseEnv()) {
    return demoNotifications;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const notifications: Notification[] = [];

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [ordersRes, paymentsRes, customersRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_status, created_at, customers(first_name, last_name)")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("payments")
        .select("id, amount, paid_at, orders(customers(first_name, last_name))")
        .gte("paid_at", since)
        .order("paid_at", { ascending: false })
        .limit(5),
      supabase
        .from("customers")
        .select("id, first_name, last_name, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (ordersRes.data) {
      for (const order of ordersRes.data) {
        const customer = order.customers as { first_name: string | null; last_name: string | null } | null;
        const customerName = customer
          ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Unknown"
          : "Unknown";
        const type: NotificationType =
          order.order_status === "confirmed"
            ? "order_confirmed"
            : order.order_status === "delivered" || order.order_status === "scheduled"
              ? "delivery_scheduled"
              : "new_order";
        notifications.push({
          id: `order-${order.id}`,
          type,
          title:
            type === "order_confirmed"
              ? "Order confirmed"
              : type === "delivery_scheduled"
                ? "Delivery scheduled"
                : "New order received",
          description: `Order #${order.id} — ${customerName}`,
          timestamp: relativeTime(order.created_at),
          read: false,
        });
      }
    }

    if (paymentsRes.data) {
      for (const payment of paymentsRes.data) {
        const orderRel = payment.orders as { customers: { first_name: string | null; last_name: string | null } | null } | null;
        const customerName = orderRel?.customers
          ? [orderRel.customers.first_name, orderRel.customers.last_name].filter(Boolean).join(" ") || "Unknown"
          : "Unknown";
        notifications.push({
          id: `payment-${payment.id}`,
          type: "payment_received",
          title: "Payment received",
          description: `$${Number(payment.amount).toFixed(2)} from ${customerName}`,
          timestamp: relativeTime(payment.paid_at ?? new Date().toISOString()),
          read: false,
        });
      }
    }

    if (customersRes.data) {
      for (const customer of customersRes.data) {
        const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Unknown";
        notifications.push({
          id: `customer-${customer.id}`,
          type: "new_customer",
          title: "New customer signed up",
          description: `${customerName} created an account`,
          timestamp: relativeTime(customer.created_at),
          read: false,
        });
      }
    }

    notifications.sort((a, b) => {
      const parseRelative = (t: string) => {
        const match = t.match(/^(\d+)([mhdw])/);
        if (!match) return 0;
        const val = Number(match[1]);
        const unit = match[2];
        if (unit === "m") return val;
        if (unit === "h") return val * 60;
        if (unit === "d") return val * 1440;
        if (unit === "w") return val * 10080;
        return 0;
      };
      return parseRelative(a.timestamp) - parseRelative(b.timestamp);
    });

    return notifications.length > 0 ? notifications : demoNotifications;
  } catch {
    return demoNotifications;
  }
}

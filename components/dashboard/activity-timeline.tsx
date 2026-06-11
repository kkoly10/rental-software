import Link from "next/link";
import type { Notification, NotificationType } from "@/lib/data/notifications";

/**
 * Recent activity timeline (Patch 4) — the mockup's dotted-rail feed.
 * Renders the org's real notification stream (new orders, payments,
 * deliveries, messages…) as a timeline, each row dotted in its domain
 * colour and linking through to the relevant tab.
 */

const DOT_COLOR: Record<NotificationType, string> = {
  new_order: "var(--secondary)",
  payment_received: "var(--success)",
  payment_failed: "var(--danger)",
  payment_dispute: "var(--danger)",
  order_confirmed: "var(--success)",
  delivery_scheduled: "var(--info)",
  new_customer: "var(--accent)",
  low_inventory: "var(--warning)",
  new_message: "var(--info)",
};

export function ActivityTimeline({ items }: { items: Notification[] }) {
  return (
    <div className="activity">
      {items.map((n, i) => {
        const dot = DOT_COLOR[n.type] ?? "var(--secondary)";
        const isLast = i === items.length - 1;
        const row = (
          <div className="activity__item" style={{ paddingBottom: isLast ? 0 : 18 }}>
            <span className="activity__dot" style={{ background: dot }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <strong style={{ fontSize: 14 }}>{n.title}</strong>
                <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {n.timestamp}
                </span>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2, lineHeight: 1.5 }}>
                {n.description}
              </div>
            </div>
          </div>
        );
        return n.link ? (
          <Link key={n.id} href={n.link} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            {row}
          </Link>
        ) : (
          <div key={n.id}>{row}</div>
        );
      })}
    </div>
  );
}

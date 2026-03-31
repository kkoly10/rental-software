"use client";

import type { RouteStopEnhanced } from "@/lib/types";

type Props = {
  stops: RouteStopEnhanced[];
};

const STATUS_COLORS: Record<string, string> = {
  assigned: "var(--primary)",
  en_route: "var(--warning)",
  in_progress: "var(--warning)",
  completed: "var(--accent)",
};

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(status: string): string {
  if (status === "completed") return "success";
  if (status === "in_progress" || status === "en_route") return "warning";
  return "default";
}

export function RouteTimeline({ stops }: Props) {
  const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
  const activeIndex = sorted.findIndex(
    (s) => s.status === "in_progress" || s.status === "en_route"
  );

  return (
    <div className="route-timeline">
      {sorted.map((stop, index) => {
        const isActive = index === activeIndex;
        const isCompleted = stop.status === "completed";
        const color = STATUS_COLORS[stop.status] ?? "var(--primary)";
        const isLast = index === sorted.length - 1;

        return (
          <div
            key={stop.id}
            className={`route-timeline-item${isActive ? " route-timeline-active" : ""}`}
          >
            <div className="route-timeline-indicator">
              <div
                className={`route-timeline-dot${isCompleted ? " route-timeline-dot-completed" : ""}`}
                style={{ borderColor: color, background: isCompleted ? color : "var(--surface)" }}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="route-stop-number" style={{ color }}>{stop.sequence}</span>
                )}
              </div>
              {!isLast && <div className="route-timeline-line" />}
            </div>

            <div className="route-timeline-content">
              <div className="route-stop-card">
                <div className="route-stop-card-header">
                  <strong>{stop.customerName ?? `Stop ${stop.sequence}`}</strong>
                  <span
                    className="route-stop-badge"
                    data-tone={statusTone(stop.status)}
                  >
                    {statusLabel(stop.status)}
                  </span>
                </div>
                {stop.address && (
                  <div className="route-stop-address">{stop.address}</div>
                )}
                <div className="route-stop-meta">
                  <span className="route-stop-type">
                    {stop.type === "pickup" ? "Pickup" : "Delivery"}
                  </span>
                  {stop.scheduledTime && (
                    <span className="route-stop-time">{stop.scheduledTime}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

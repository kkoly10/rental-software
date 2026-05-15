"use client";

import type { RouteDetailEnhanced } from "@/lib/types";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

type Props = {
  route: RouteDetailEnhanced;
};

export function DeliveryStats({ route }: Props) {
  const { messages } = useI18n();
  const t = messages.forms.routing.stats;
  const pct =
    route.totalStops > 0
      ? Math.round((route.completedStops / route.totalStops) * 100)
      : 0;

  return (
    <div className="route-stats-bar">
      <div className="route-stat">
        <span className="route-stat-value">{route.totalStops}</span>
        <span className="route-stat-label">{t.totalStops}</span>
      </div>
      <div className="route-stat">
        <span className="route-stat-value" style={{ color: "var(--accent)" }}>
          {route.completedStops}
        </span>
        <span className="route-stat-label">{t.completed}</span>
      </div>
      <div className="route-stat">
        <span className="route-stat-value" style={{ color: "var(--warning)" }}>
          {route.inProgressStops}
        </span>
        <span className="route-stat-label">{t.inProgress}</span>
      </div>
      <div className="route-stat">
        <span className="route-stat-value">
          {route.nextDeliveryTime ?? "--"}
        </span>
        <span className="route-stat-label">{t.nextDelivery}</span>
      </div>
      <div className="route-stat route-stat-progress">
        <div className="route-progress-bar">
          <div
            className="route-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="route-stat-label">{formatMessage(t.percentComplete, { pct })}</span>
      </div>
    </div>
  );
}

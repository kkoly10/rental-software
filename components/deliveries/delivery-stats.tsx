import type { RouteDetailEnhanced } from "@/lib/types";

type Props = {
  route: RouteDetailEnhanced;
};

export function DeliveryStats({ route }: Props) {
  const pct =
    route.totalStops > 0
      ? Math.round((route.completedStops / route.totalStops) * 100)
      : 0;

  return (
    <div className="route-stats-bar">
      <div className="route-stat">
        <span className="route-stat-value">{route.totalStops}</span>
        <span className="route-stat-label">Total stops</span>
      </div>
      <div className="route-stat">
        <span className="route-stat-value" style={{ color: "var(--accent)" }}>
          {route.completedStops}
        </span>
        <span className="route-stat-label">Completed</span>
      </div>
      <div className="route-stat">
        <span className="route-stat-value" style={{ color: "var(--warning)" }}>
          {route.inProgressStops}
        </span>
        <span className="route-stat-label">In progress</span>
      </div>
      <div className="route-stat">
        <span className="route-stat-value">
          {route.nextDeliveryTime ?? "--"}
        </span>
        <span className="route-stat-label">Next delivery</span>
      </div>
      <div className="route-stat route-stat-progress">
        <div className="route-progress-bar">
          <div
            className="route-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="route-stat-label">{pct}% complete</span>
      </div>
    </div>
  );
}

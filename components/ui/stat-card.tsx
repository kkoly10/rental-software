import type { CSSProperties, ReactNode } from "react";
import { Sparkline } from "./sparkline";

/**
 * Carnival v2 StatCard.
 * Backward compatible: existing callers pass { label, value, meta } and get
 * an eyebrow label + tabular value for free. New optional props add craft:
 *   - icon   : a line icon rendered in a tinted chip
 *   - accent : domain color (CSS color or var) for the icon chip + left edge
 *   - trend  : { dir, text } small delta line
 *   - spark  : real daily series → mini sparkline (top-right)
 */
export function StatCard({
  label,
  value,
  meta,
  icon,
  accent,
  trend,
  spark,
}: {
  label: string;
  value: string;
  meta?: string;
  icon?: ReactNode;
  accent?: string;
  trend?: { dir: "up" | "down" | "flat"; text: string };
  spark?: number[];
}) {
  const crafted = Boolean(icon || accent);
  const accentColor = accent ?? "var(--primary)";
  const sparkEl =
    spark && spark.length >= 2 ? <Sparkline data={spark} color={accentColor} /> : null;
  const trendColor =
    trend?.dir === "up"
      ? "var(--success)"
      : trend?.dir === "down"
      ? "var(--danger)"
      : "var(--text-muted)";

  return (
    <div
      className={`stat-card${crafted ? " stat-card--craft" : ""}`}
      style={crafted ? ({ "--stat-accent": accentColor } as CSSProperties) : undefined}
    >
      {(icon || trend || sparkEl) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          {icon ? (
            <span
              className="stat-card__icon"
              style={{
                background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
                color: accentColor,
              }}
            >
              {icon}
            </span>
          ) : (
            <span />
          )}
          {sparkEl ??
            (trend && (
              <span style={{ fontSize: 12.5, fontWeight: 600, color: trendColor }}>
                {trend.dir === "up" ? "↑ " : trend.dir === "down" ? "↓ " : ""}
                {trend.text}
              </span>
            ))}
        </div>
      )}
      <strong className="tnum" style={{ display: "block", fontSize: "1.75rem", lineHeight: 1.05 }}>
        {value}
      </strong>
      <div className="eyebrow" style={{ marginTop: 8 }}>
        {label}
      </div>
      {meta && (
        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          {meta}
        </div>
      )}
    </div>
  );
}

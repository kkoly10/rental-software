/**
 * Sparkline — tiny area+line chart for stat cards (Patch 4 polish).
 * Ported from the Korent v2 dashboard mockup. Renders nothing when there
 * isn't enough real signal (fewer than 2 points or an all-zero series), so
 * a card never shows a fabricated flat trend.
 */
export function Sparkline({
  data,
  color = "var(--primary)",
  w = 84,
  h = 28,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
}) {
  const pts = (data ?? []).filter((n) => Number.isFinite(n));
  const max = Math.max(...pts, 0);
  if (pts.length < 2 || max <= 0) return null;

  const step = w / (pts.length - 1);
  const coords = pts.map(
    (v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`
  );
  const line = `M${coords.join(" L")}`;
  const area = `${line} L${w.toFixed(1)},${h} L0,${h} Z`;
  const last = coords[coords.length - 1].split(",");
  // Deterministic gradient id (no Math.random → no hydration surprises).
  const gid = `spark-${color.replace(/[^a-z0-9]/gi, "")}-${pts.length}-${Math.round(
    pts.reduce((a, b) => a + b, 0)
  )}`;

  return (
    <svg width={w} height={h} style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
    </svg>
  );
}

export function StatusBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "info" | "accent";
}) {
  // Carnival v2: dotted tonal pill (replaces flat .badge). API unchanged —
  // `tone` is now a superset, so existing callers keep working.
  const className = tone === "default" ? "pill" : `pill pill--${tone}`;
  return <span className={className}>{label}</span>;
}

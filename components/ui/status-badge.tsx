export function StatusBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const className =
    tone === "success"
      ? "badge success"
      : tone === "warning"
      ? "badge warning"
      : tone === "danger"
      ? "badge danger"
      : "badge";

  return <span className={className}>{label}</span>;
}
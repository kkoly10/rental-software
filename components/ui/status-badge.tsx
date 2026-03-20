export function StatusBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "warning";
}) {
  const className =
    tone === "success"
      ? "badge success"
      : tone === "warning"
        ? "badge warning"
        : "badge";

  return <span className={className}>{label}</span>;
}

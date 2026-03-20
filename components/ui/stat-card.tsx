export function StatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="stat-card">
      <div className="muted">{label}</div>
      <strong>{value}</strong>
      <div className="muted">{meta}</div>
    </div>
  );
}

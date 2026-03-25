import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardNotFound() {
  return (
    <DashboardShell
      title="Not Found"
      description="The page you are looking for does not exist."
    >
      <section className="panel" style={{ textAlign: "center", padding: 48 }}>
        <div className="kicker">404</div>
        <h2 style={{ margin: "8px 0 12px" }}>Page not found</h2>
        <div className="muted" style={{ marginBottom: 20 }}>
          This dashboard page does not exist or the record was not found.
        </div>
        <Link href="/dashboard" className="primary-btn">
          Back to Dashboard
        </Link>
      </section>
    </DashboardShell>
  );
}

import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getMessages } from "@/lib/i18n/server";

export default async function OrderNotFound() {
  const m = await getMessages();
  return (
    <DashboardShell
      title={m.errors.notFound.title}
      description={m.errors.notFound.description}
    >
      <section className="panel" style={{ textAlign: "center", padding: 48 }}>
        <div className="kicker">404</div>
        <h2 style={{ margin: "8px 0 12px" }}>{m.errors.notFound.title}</h2>
        <div className="muted" style={{ marginBottom: 24 }}>
          {m.errors.notFound.description}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/dashboard/orders" className="primary-btn">
            {m.dashboard.nav.orders}
          </Link>
          <Link href="/dashboard" className="secondary-btn">
            {m.dashboard.nav.dashboard}
          </Link>
        </div>
      </section>
    </DashboardShell>
  );
}

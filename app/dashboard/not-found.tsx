import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getMessages } from "@/lib/i18n/server";
import { headers } from "next/headers";

export default async function DashboardNotFound() {
  const [m, headersList] = await Promise.all([getMessages(), headers()]);
  const referer = headersList.get("referer") ?? "";

  // Best-guess parent section based on the referer URL so we can offer a
  // contextual "go back" link (e.g. clicking a stale notification order link).
  let backLink = "/dashboard";
  let backLabel = m.dashboard.nav.dashboard;
  if (referer.includes("/dashboard/orders")) {
    backLink = "/dashboard/orders";
    backLabel = m.dashboard.nav.orders;
  } else if (referer.includes("/dashboard/customers")) {
    backLink = "/dashboard/customers";
    backLabel = m.dashboard.nav.customers;
  } else if (referer.includes("/dashboard/products")) {
    backLink = "/dashboard/products";
    backLabel = m.dashboard.nav.products;
  }

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
          <Link href={backLink} className="primary-btn">
            {backLabel}
          </Link>
          {backLink !== "/dashboard" && (
            <Link href="/dashboard" className="secondary-btn">
              {m.dashboard.nav.dashboard}
            </Link>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

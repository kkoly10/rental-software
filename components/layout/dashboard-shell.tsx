"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { dashboardNavItems } from "@/lib/navigation/dashboard-nav";
import { CopilotLauncher } from "@/components/copilot/copilot-launcher";

function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="sidebar-layout">
      <aside className="sidebar">
        <Link href="/dashboard" className="logo" style={{ color: "white", marginBottom: 20, display: "block" }}>
          RentalOS
        </Link>

        {dashboardNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isNavItemActive(pathname, item.href) ? "active" : undefined}
            data-tour={item.tourId}
          >
            {item.label}
          </Link>
        ))}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.12)" }}>
          <Link href="/" style={{ display: "block", padding: "12px 14px", borderRadius: 12, marginBottom: 8, opacity: 0.7 }}>
            Public Site
          </Link>
          <button
            type="button"
            style={{
              background: "rgba(255,255,255,.08)",
              color: "rgba(255,255,255,.7)",
              border: "none",
              borderRadius: 12,
              padding: "12px 14px",
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              font: "inherit",
            }}
            onClick={async () => {
              const { signOut } = await import("@/lib/auth/actions");
              await signOut();
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-shell">
        <div className="section-header">
          <div>
            <div className="kicker">Inflatable-first platform</div>
            <h1 style={{ margin: "6px 0 8px" }}>{title}</h1>
            <div className="muted">{description}</div>
          </div>
        </div>
        {children}
      </main>

      <CopilotLauncher currentRoute={pathname} />
    </div>
  );
}

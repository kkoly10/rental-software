"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { dashboardNavItems } from "@/lib/navigation/dashboard-nav";

function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

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
        <div className="logo" style={{ color: "white", marginBottom: 20 }}>
          RentalOS Admin
        </div>

        {dashboardNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isNavItemActive(pathname, item.href) ? "active" : undefined}
          >
            {item.label}
          </Link>
        ))}
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
    </div>
  );
}
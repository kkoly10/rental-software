import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inventory", label: "Public Catalog" },
  { href: "/checkout", label: "Checkout" },
  { href: "/dashboard/deliveries", label: "Deliveries" },
  { href: "/crew/today", label: "Crew Mobile" },
];

export function DashboardShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="sidebar-layout">
      <aside className="sidebar">
        <div className="logo" style={{ color: "white", marginBottom: 20 }}>
          RentalOS Admin
        </div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={item.href === "/dashboard" ? "active" : undefined}
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { dashboardNavItems } from "@/lib/navigation/dashboard-nav";
import { CopilotLauncher } from "@/components/copilot/copilot-launcher";
import { NotificationCenter } from "@/components/dashboard/notification-center";
import { Breadcrumbs } from "@/components/dashboard/breadcrumbs";
import { CommandPalette } from "@/components/dashboard/command-palette";
import type { Notification } from "@/lib/data/notifications";
import { fetchUnreadMessageCount } from "@/lib/messages/actions";
import { getSubscriptionStatus } from "@/lib/stripe/get-subscription-status";
import { SubscriptionBanner } from "@/components/settings/subscription-banner";

function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({
  title,
  description,
  children,
  notifications = [],
  unreadMessages = 0,
  subscriptionStatus: initialSubscriptionStatus,
}: {
  title: string;
  description: string;
  children: ReactNode;
  notifications?: Notification[];
  unreadMessages?: number;
  subscriptionStatus?: string | null;
}) {
  const pathname = usePathname();
  const [badgeCount, setBadgeCount] = useState(unreadMessages);
  const [subStatus, setSubStatus] = useState(initialSubscriptionStatus ?? null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    fetchUnreadMessageCount().then(setBadgeCount).catch(() => {});
    // Fetch subscription status on every page to ensure the banner shows everywhere,
    // even on dashboard pages that don't pass the prop from the server.
    getSubscriptionStatus().then((s) => { if (s) setSubStatus(s); }).catch(() => {});
  }, [pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobileNav();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen, closeMobileNav]);

  useEffect(() => {
    if (!mobileNavOpen || !drawerRef.current) return;
    const drawer = drawerRef.current;
    const focusable = drawer.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    drawer.addEventListener("keydown", trapFocus);
    return () => drawer.removeEventListener("keydown", trapFocus);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const renderMessagesBadge = () =>
    badgeCount > 0 ? (
      <span className="dashboard-nav-badge">{badgeCount > 9 ? "9+" : badgeCount}</span>
    ) : null;

  return (
    <div className="sidebar-layout">
      <aside className="sidebar dashboard-sidebar-desktop">
        <Link href="/dashboard" className="logo" style={{ color: "white", marginBottom: 20, display: "block" }}>
          Korent
        </Link>

        {dashboardNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isNavItemActive(pathname, item.href) ? "active" : undefined}
            data-tour={item.tourId}
            style={item.label === "Messages" ? { display: "flex", alignItems: "center", justifyContent: "space-between" } : undefined}
          >
            {item.label}
            {item.label === "Messages" && renderMessagesBadge()}
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
        <div className="dashboard-mobile-bar">
          <button
            ref={menuButtonRef}
            type="button"
            className="dashboard-mobile-menu-btn"
            aria-label="Open dashboard navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            Menu
          </button>
          <Link href="/dashboard" className="logo">
            Korent
          </Link>
          <NotificationCenter initialNotifications={notifications} />
        </div>
        <SubscriptionBanner status={subStatus} />
        <Breadcrumbs />
        <div className="section-header">
          <div>
            <div className="kicker">Inflatable-first platform</div>
            <h1 style={{ margin: "6px 0 8px" }}>{title}</h1>
            <div className="muted">{description}</div>
          </div>
          <div className="dashboard-desktop-notifications">
            <NotificationCenter initialNotifications={notifications} />
          </div>
        </div>
        {children}
      </main>

      {mobileNavOpen && (
        <div className="mobile-menu-overlay" onClick={closeMobileNav}>
          <div
            ref={drawerRef}
            className="mobile-menu-drawer dashboard-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard navigation menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-menu-header">
              <span className="mobile-menu-title">Dashboard menu</span>
              <button
                type="button"
                className="mobile-menu-close"
                aria-label="Close menu"
                onClick={closeMobileNav}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <nav className="mobile-menu-nav">
              {dashboardNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileNav}
                  className={isNavItemActive(pathname, item.href) ? "active" : undefined}
                >
                  {item.label}
                  {item.label === "Messages" && renderMessagesBadge()}
                </Link>
              ))}
            </nav>
            <div className="mobile-menu-footer">
              <Link href="/" className="secondary-btn" onClick={closeMobileNav}>
                Public Site
              </Link>
              <button
                type="button"
                className="primary-btn"
                onClick={async () => {
                  closeMobileNav();
                  const { signOut } = await import("@/lib/auth/actions");
                  await signOut();
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette />
      <CopilotLauncher currentRoute={pathname} />
    </div>
  );
}

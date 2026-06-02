"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  getGroupedNavItemsForVertical,
  type NavGroup,
  type NavItem,
} from "@/lib/navigation/dashboard-nav";
import { CopilotLauncher } from "@/components/copilot/copilot-launcher";
import { NotificationCenter } from "@/components/dashboard/notification-center";
import { Breadcrumbs } from "@/components/dashboard/breadcrumbs";
import { CommandPalette } from "@/components/dashboard/command-palette";
import type { Notification } from "@/lib/data/notifications";
import { fetchUnreadMessageCount } from "@/lib/messages/actions";
import { getSubscriptionStatus } from "@/lib/stripe/get-subscription-status";
import { SubscriptionBanner } from "@/components/settings/subscription-banner";
import { useI18n } from "@/lib/i18n/provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { reportClientError } from "@/lib/observability/client";

function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Per-org localStorage key so a browser shared between operator
// accounts doesn't leak collapse state across orgs.  We fall back to
// the global key if the orgId isn't known yet (initial paint /
// pre-businessType load).
const GROUP_COLLAPSE_KEY_BASE = "korent-sidebar-collapsed-groups";

function collapseKey(orgId: string | null): string {
  return orgId ? `${GROUP_COLLAPSE_KEY_BASE}:${orgId}` : GROUP_COLLAPSE_KEY_BASE;
}

function loadCollapsedGroups(orgId: string | null): Partial<Record<NavGroup, boolean>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(collapseKey(orgId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
}

function persistCollapsedGroups(orgId: string | null, state: Partial<Record<NavGroup, boolean>>) {
  try {
    window.localStorage.setItem(collapseKey(orgId), JSON.stringify(state));
  } catch {
    // storage unavailable — silently skip; collapse state just won't persist.
  }
}

export function DashboardShell({
  title,
  description,
  children,
  notifications = [],
  unreadMessages = 0,
  subscriptionStatus: initialSubscriptionStatus,
  hideHeader = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  notifications?: Notification[];
  unreadMessages?: number;
  subscriptionStatus?: string | null;
  /** When the page renders its own headline (e.g. /dashboard's
      `<DashboardGreeting>` replaces the generic "Operator Dashboard"
      title), set this to true so the shell omits the section-header
      stack and avoids two competing headlines on the same page. */
  hideHeader?: boolean;
}) {
  const pathname = usePathname();
  const { locale, messages: m } = useI18n();
  const [badgeCount, setBadgeCount] = useState(unreadMessages);
  const [subStatus, setSubStatus] = useState(initialSubscriptionStatus ?? null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [publicSiteUrl, setPublicSiteUrl] = useState("/");
  // `null` = still loading (renders skeleton).  Empty string is treated
  // the same as a fully-known orgType — show every nav item.  Previously
  // we kept the skeleton until businessType was truthy, which left brand-
  // new orgs (no businessType set) stuck on the skeleton forever.
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    // `cancelled` flag prevents stale responses from server actions overwriting
    // state if the user navigates away mid-request.
    let cancelled = false;
    fetchUnreadMessageCount()
      .then((n) => { if (!cancelled) setBadgeCount(n); })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[dashboard-shell] fetchUnreadMessageCount failed:", err);
        reportClientError({
          source: "dashboard-shell",
          message: `fetchUnreadMessageCount failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      });
    // Fetch subscription status on every page to ensure the banner shows everywhere,
    // even on dashboard pages that don't pass the prop from the server.
    getSubscriptionStatus()
      .then((s) => { if (!cancelled && s) setSubStatus(s); })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[dashboard-shell] getSubscriptionStatus failed:", err);
        reportClientError({
          source: "dashboard-shell",
          message: `getSubscriptionStatus failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      });
    return () => { cancelled = true; };
  }, [pathname]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/storefront-url", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as { url?: string };
        return payload.url ?? null;
      })
      .then((url) => {
        if (url) setPublicSiteUrl(url);
      })
      .catch(() => {});
    fetch("/api/org-type", { signal: controller.signal })
      .then(async (r) => (r.ok ? (await r.json() as { businessType?: string; organizationId?: string }) : null))
      .then((data) => {
        // Always transition off the skeleton once the API responds —
        // even if businessType is empty/missing.  `getNavItemsForVertical`
        // handles unknown verticals by including all unverticalised items;
        // empty string is a fine signal for "show every nav".
        if (data) {
          setBusinessType(data.businessType ?? "");
          if (data.organizationId) setOrgId(data.organizationId);
        }
      })
      .catch((err) => {
        // AbortError is fired by controller.abort() during unmount — ignore it
        // so we don't reset state on a component that's no longer mounted.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Network/server error — fall back to the unfiltered nav rather
        // than leaving the operator stuck on the skeleton forever.
        setBusinessType("");
      });
    return () => controller.abort();
  }, []);

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

  // Cross-platform shortcut hint. SSR returns "⌘K" so the markup matches
  // initial paint on Mac; on mount we swap to "Ctrl K" if userAgent
  // looks like Windows/Linux. Avoids hydration mismatch by only
  // touching state after mount.
  //
  // navigator.platform is deprecated and increasingly empty in modern
  // browsers; prefer the high-entropy userAgentData when available
  // (Chrome/Edge), fall back to userAgent regex elsewhere.
  const [shortcutLabel, setShortcutLabel] = useState<string>("⌘K");
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const uaData = (navigator as Navigator & {
      userAgentData?: { platform?: string };
    }).userAgentData;
    const platform = uaData?.platform ?? navigator.platform ?? "";
    const ua = navigator.userAgent ?? "";
    const isMac = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac|iPhone|iPad|iPod/i.test(ua);
    if (!isMac) setShortcutLabel("Ctrl K");
  }, []);

  const renderMessagesBadge = () =>
    badgeCount > 0 ? (
      <span className="dashboard-nav-badge">{badgeCount > 9 ? "9+" : badgeCount}</span>
    ) : null;

  // Sidebar group collapse state. Persisted in localStorage, but the group
  // containing the active route is force-expanded so the operator never
  // navigates into a folded section without seeing its siblings.
  const [collapsedGroups, setCollapsedGroups] = useState<
    Partial<Record<NavGroup, boolean>>
  >({});
  useEffect(() => {
    setCollapsedGroups(loadCollapsedGroups(orgId));
  }, [orgId]);

  // Render guard: null = still loading (show skeleton).  Empty string
  // = API responded but the org has no businessType set; treat that
  // as a known state and resolve groupedNav, which handles the empty
  // case by including all unverticalised items.  Without the explicit
  // `!== null` check, `"" ? ... : null` is falsy and the sidebar
  // stays stuck on the skeleton — the same #20 trap from before, just
  // shifted one render-stage down.
  const groupedNav = useMemo(
    () =>
      businessType !== null
        ? getGroupedNavItemsForVertical(businessType)
        : null,
    [businessType]
  );

  // Which group does the current route belong to? That group must stay
  // expanded regardless of saved collapse state.
  const activeGroup: NavGroup | null = useMemo(() => {
    if (!groupedNav) return null;
    for (const g of groupedNav.groups) {
      if (g.items.some((i) => isNavItemActive(pathname, i.href))) return g.id;
    }
    return null;
  }, [groupedNav, pathname]);

  const toggleGroup = useCallback(
    (id: NavGroup) => {
      setCollapsedGroups((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        persistCollapsedGroups(orgId, next);
        return next;
      });
    },
    [orgId]
  );

  const openCommandPalette = useCallback(() => {
    window.dispatchEvent(new CustomEvent("korent:open-command-palette"));
  }, []);
  const openCopilot = useCallback(() => {
    window.dispatchEvent(new CustomEvent("korent:open-copilot"));
  }, []);

  // Shared item renderer — used by both the desktop sidebar and the
  // mobile drawer so badges/active state/translation lookups stay in
  // exactly one place.
  const renderNavLink = (item: NavItem, onClick?: () => void) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={onClick}
      className={isNavItemActive(pathname, item.href) ? "active" : undefined}
      data-tour={item.tourId}
      style={
        item.key === "messages"
          ? { display: "flex", alignItems: "center", justifyContent: "space-between" }
          : undefined
      }
    >
      {m.dashboard.nav[item.key]}
      {item.key === "messages" && renderMessagesBadge()}
    </Link>
  );

  const renderGroupHeader = (
    id: NavGroup,
    isCollapsed: boolean,
    isLocked: boolean
  ) => {
    // When the active route is inside this group we render the header as
    // a static section label.  Clicking would otherwise write a "collapsed"
    // value to localStorage that takes effect later — a ghost write the
    // operator can't trace.
    if (isLocked) {
      return (
        <div
          className="sidebar-group-header"
          aria-label={m.dashboard.navGroups[id]}
          data-locked="true"
        >
          <span>{m.dashboard.navGroups[id]}</span>
        </div>
      );
    }
    return (
      <button
        type="button"
        className="sidebar-group-header"
        aria-expanded={!isCollapsed}
        aria-controls={`sidebar-group-${id}`}
        onClick={() => toggleGroup(id)}
        title={
          isCollapsed
            ? m.dashboard.navGroups.expandGroup
            : m.dashboard.navGroups.collapseGroup
        }
      >
        <span>{m.dashboard.navGroups[id]}</span>
        <span className="sidebar-group-chevron" aria-hidden="true">
          {isCollapsed ? "▸" : "▾"}
        </span>
      </button>
    );
  };

  const renderSidebarNavBody = (onItemClick?: () => void) => {
    if (!groupedNav) {
      // Skeleton during business-type load.  Mirrors the live grouped
      // layout (one Dashboard row above 4 group sections, items per
      // section roughly matches the real counts) so the first paint
      // doesn't visibly reshuffle when groupedNav resolves.
      const skeletonGroups: number[] = [5, 4, 3, 4]; // Ops/Catalog/Finance/Admin
      return (
        <>
          {/* Dashboard placeholder */}
          <div
            style={{
              height: 22,
              margin: "0 0 12px",
              borderRadius: 10,
              background: "rgba(45,31,20,.08)",
            }}
          />
          {skeletonGroups.map((rows, gi) => (
            <div key={gi} style={{ marginTop: gi === 0 ? 6 : 14 }}>
              <div
                style={{
                  height: 8,
                  width: 56,
                  margin: "8px 14px 10px",
                  borderRadius: 4,
                  background: "rgba(45,31,20,.14)",
                }}
              />
              {Array.from({ length: rows }).map((__, ii) => (
                <div
                  key={ii}
                  style={{
                    height: 20,
                    margin: "6px 0",
                    borderRadius: 10,
                    background: "rgba(45,31,20,.06)",
                  }}
                />
              ))}
            </div>
          ))}
        </>
      );
    }

    return (
      <>
        {groupedNav.top.map((item) => renderNavLink(item, onItemClick))}

        {groupedNav.groups.map(({ id, items }) => {
          const forcedOpen = activeGroup === id;
          const isCollapsed = !forcedOpen && Boolean(collapsedGroups[id]);
          return (
            <div key={id} className="sidebar-group">
              {renderGroupHeader(id, isCollapsed, forcedOpen)}
              <div
                id={`sidebar-group-${id}`}
                hidden={isCollapsed}
                className="sidebar-group-items"
              >
                {items.map((item) => renderNavLink(item, onItemClick))}
              </div>
            </div>
          );
        })}

        {groupedNav.trailing.length > 0 && (
          <div className="sidebar-group-trailing">
            {groupedNav.trailing.map((item) => renderNavLink(item, onItemClick))}
          </div>
        )}

        {groupedNav.footer.length > 0 && (
          <div className="sidebar-group-footer">
            {groupedNav.footer.map((item) => renderNavLink(item, onItemClick))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="sidebar-layout">
      <aside className="sidebar dashboard-sidebar-desktop">
        <Link href="/dashboard" className="logo" style={{ color: "var(--primary)", marginBottom: 14, display: "block" }}>
          Korent
        </Link>

        {/* Search affordance — opens the existing Cmd-K palette so the
            feature stops being hidden behind a keyboard shortcut. */}
        <button
          type="button"
          className="sidebar-search-trigger"
          onClick={openCommandPalette}
          aria-label={m.dashboard.navGroups.searchAriaLabel}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="sidebar-search-placeholder">
            {m.dashboard.navGroups.searchPlaceholder}
          </span>
          <span className="sidebar-search-shortcut">{shortcutLabel}</span>
        </button>

        {/* Ask AI entry — pairs with the floating Copilot launcher.
            Surfaces the existing AI panel as a discoverable nav item
            instead of relying on a bottom-right circle. */}
        <button
          type="button"
          className="sidebar-ask-ai"
          onClick={openCopilot}
        >
          <span aria-hidden="true">✦</span>
          <span>{m.dashboard.navGroups.askAi}</span>
        </button>

        <div className="sidebar-nav-body">{renderSidebarNavBody()}</div>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div style={{ padding: "0 14px 12px" }}>
            <LanguageSwitcher currentLocale={locale} ariaLabel={m.language.label} />
          </div>
          <a href={publicSiteUrl} style={{ display: "block", padding: "12px 14px", borderRadius: 12, marginBottom: 8, color: "var(--text-soft)" }}>
            {m.dashboard.nav.publicSite}
          </a>
          <button
            type="button"
            style={{
              background: "var(--surface-muted)",
              color: "var(--text-soft)",
              border: "1px solid var(--border)",
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
            {m.dashboard.nav.signOut}
          </button>
        </div>
      </aside>

      <main className="main-shell">
        <div className="dashboard-mobile-bar">
          <button
            ref={menuButtonRef}
            type="button"
            className="dashboard-mobile-menu-btn"
            aria-label={m.dashboard.shell.openNav}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            {m.common.menu}
          </button>
          <Link href="/dashboard" className="logo">
            Korent
          </Link>
          <NotificationCenter initialNotifications={notifications} />
        </div>
        <SubscriptionBanner status={subStatus} />
        <Breadcrumbs />
        {hideHeader ? (
          // Page renders its own headline (e.g. /dashboard's <DashboardGreeting>).
          // The shell still owns the notification bell on desktop so it doesn't
          // vanish along with the section header.
          <div className="dashboard-desktop-notifications dashboard-desktop-notifications--floating">
            <NotificationCenter initialNotifications={notifications} />
          </div>
        ) : (
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.shell.kicker}</div>
              <h1 style={{ margin: "6px 0 8px" }}>{title}</h1>
              <div className="muted">{description}</div>
            </div>
            <div className="dashboard-desktop-notifications">
              <NotificationCenter initialNotifications={notifications} />
            </div>
          </div>
        )}
        {children}
      </main>

      {mobileNavOpen && (
        <div className="mobile-menu-overlay" onClick={closeMobileNav}>
          <div
            ref={drawerRef}
            className="mobile-menu-drawer dashboard-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={m.dashboard.shell.mobileMenu}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-menu-header">
              <span className="mobile-menu-title">{m.dashboard.shell.mobileMenu}</span>
              <button
                type="button"
                className="mobile-menu-close"
                aria-label={m.common.closeMenu}
                onClick={closeMobileNav}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <nav className="mobile-menu-nav">
              <button
                type="button"
                className="sidebar-search-trigger sidebar-search-trigger--mobile"
                onClick={() => {
                  closeMobileNav();
                  openCommandPalette();
                }}
                aria-label={m.dashboard.navGroups.searchAriaLabel}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <span className="sidebar-search-placeholder">
                  {m.dashboard.navGroups.searchPlaceholder}
                </span>
              </button>
              <button
                type="button"
                className="sidebar-ask-ai"
                onClick={() => {
                  closeMobileNav();
                  openCopilot();
                }}
              >
                <span aria-hidden="true">✦</span>
                <span>{m.dashboard.navGroups.askAi}</span>
              </button>
              {renderSidebarNavBody(closeMobileNav)}
            </nav>
            <div className="mobile-menu-footer">
              <LanguageSwitcher currentLocale={locale} ariaLabel={m.language.label} />
              <a href={publicSiteUrl} className="secondary-btn" onClick={closeMobileNav}>
                {m.dashboard.nav.publicSite}
              </a>
              <button
                type="button"
                className="primary-btn"
                onClick={async () => {
                  closeMobileNav();
                  const { signOut } = await import("@/lib/auth/actions");
                  await signOut();
                }}
              >
                {m.dashboard.nav.signOut}
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

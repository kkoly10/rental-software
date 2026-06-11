import type { Messages } from "@/lib/i18n/dictionaries";

// Group buckets for the sidebar.  Items with no group render outside any
// section (Dashboard at the top, Crew Mobile just above the footer).
// Group rendering order matches NAV_GROUP_ORDER below.
export type NavGroup = "ops" | "catalog" | "finance" | "admin";

type NavItem = {
  href: string;
  label: string;
  tourId: string | undefined;
  // Verticals that show this item. Undefined = shown for all verticals.
  verticals?: string[];
  // Stable key used for translation lookup.
  key: keyof Messages["dashboard"]["nav"];
  // Sidebar group bucket. Undefined = rendered outside any group.
  group?: NavGroup;
};

const ALL_NAV_ITEMS: NavItem[] = [
  // Pinned at the top, no group header.
  { href: "/dashboard",                  label: "Dashboard",     tourId: "dashboard-overview", key: "dashboard" },

  // OPS — daily work the operator opens 10+ times a day.  Customers lives
  // here (not in its own bucket) because operators look it up reactively
  // when a repeat caller comes in, not as a passive data archive.
  { href: "/dashboard/orders",           label: "Orders",        tourId: "nav-orders",         key: "orders",       group: "ops" },
  { href: "/dashboard/calendar",         label: "Calendar",      tourId: undefined,            key: "calendar",     group: "ops" },
  { href: "/dashboard/messages",         label: "Messages",      tourId: undefined,            key: "messages",     group: "ops" },
  { href: "/dashboard/customers",        label: "Customers",     tourId: undefined,            key: "customers",    group: "ops" },
  { href: "/dashboard/deliveries",       label: "Deliveries",    tourId: "nav-deliveries",     key: "deliveries",   group: "ops",     verticals: ["inflatable", "tents", "tables-and-chairs", "dance-floors", "photo-booths", "concessions", "equipment"] },

  // CATALOG — "what I rent, where, how much, is it ready".
  { href: "/dashboard/products",         label: "Products",      tourId: "nav-products",       key: "products",     group: "catalog" },
  // Seller Hub v1 (spec §32) — the operator's marketplace presence.
  { href: "/dashboard/marketplace",      label: "Marketplace",   tourId: undefined,            key: "marketplace",  group: "catalog" },
  { href: "/dashboard/pricing",          label: "Pricing",       tourId: "nav-pricing",        key: "pricing",      group: "catalog" },
  { href: "/dashboard/service-areas",    label: "Service Areas", tourId: undefined,            key: "serviceAreas", group: "catalog", verticals: ["inflatable", "tents", "tables-and-chairs", "dance-floors", "photo-booths", "concessions", "equipment"] },
  { href: "/dashboard/maintenance",      label: "Maintenance",   tourId: undefined,            key: "maintenance",  group: "catalog" },

  // FINANCE — end-of-day / end-of-week checks.  Documents lives here, not
  // in OPS, because it's the paperwork side of getting paid.
  { href: "/dashboard/payments",         label: "Payments",      tourId: "nav-payments",       key: "payments",     group: "finance" },
  { href: "/dashboard/documents",        label: "Documents",     tourId: "nav-documents",      key: "documents",    group: "finance" },
  { href: "/dashboard/analytics",        label: "Analytics",     tourId: undefined,            key: "analytics",    group: "finance" },

  // ADMIN — set-up-once / touch-once-a-quarter.  Settings/Team/Billing
  // are co-located so they stop competing with daily items for sidebar
  // real estate.  Website lives here even though new operators visit it
  // early in their first week — once their site is dialled in, traffic
  // to it drops sharply.
  { href: "/dashboard/website",          label: "Website",       tourId: "nav-website",        key: "website",      group: "admin" },
  { href: "/dashboard/settings",         label: "Settings",      tourId: undefined,            key: "settings",     group: "admin" },
  { href: "/dashboard/settings/team",    label: "Team",          tourId: undefined,            key: "team",         group: "admin" },
  { href: "/dashboard/settings/billing", label: "Billing",       tourId: undefined,            key: "billing",      group: "admin" },

  // First-class item rendered between the last group and the footer.
  // It's a separate app surface (the crew route view) — keeping it
  // visible on the sidebar matches how operators flip into it.
  { href: "/crew/today",                 label: "Crew Mobile",   tourId: undefined,            key: "crewMobile",   verticals: ["inflatable", "tents", "tables-and-chairs", "dance-floors", "photo-booths", "concessions", "equipment"] },

  // Footer item — pinned at the bottom of the sidebar regardless of
  // group state.
  { href: "/dashboard/help",             label: "Help Center",   tourId: undefined,            key: "helpCenter" },
];

// Stable render order for groups in the sidebar.  Daily work first.
export const NAV_GROUP_ORDER: readonly NavGroup[] = [
  "ops",
  "catalog",
  "finance",
  "admin",
] as const;

export function getNavItemsForVertical(businessType: string): NavItem[] {
  return ALL_NAV_ITEMS.filter(
    (item) => !item.verticals || item.verticals.includes(businessType)
  );
}

export type GroupedNav = {
  /** Items rendered above any group header — currently just Dashboard. */
  top: NavItem[];
  /** Items by group, in NAV_GROUP_ORDER. */
  groups: Array<{ id: NavGroup; items: NavItem[] }>;
  /** Items rendered between the last group and the footer — Crew Mobile. */
  trailing: NavItem[];
  /** Items pinned to the bottom of the sidebar — Help Center. */
  footer: NavItem[];
};

const FOOTER_HREFS = new Set<string>([
  "/dashboard/help",
]);

const TRAILING_HREFS = new Set<string>([
  "/crew/today",
]);

const TOP_HREFS = new Set<string>([
  "/dashboard",
]);

export function getGroupedNavItemsForVertical(
  businessType: string
): GroupedNav {
  const items = getNavItemsForVertical(businessType);

  const top = items.filter((i) => TOP_HREFS.has(i.href));
  const trailing = items.filter((i) => TRAILING_HREFS.has(i.href));
  const footer = items.filter((i) => FOOTER_HREFS.has(i.href));

  const groups = NAV_GROUP_ORDER.map((id) => ({
    id,
    items: items.filter((i) => i.group === id),
  })).filter((g) => g.items.length > 0);

  return { top, groups, trailing, footer };
}

// Backward-compatible static export for pages that don't yet have businessType context.
export const dashboardNavItems = ALL_NAV_ITEMS;

export type { NavItem };

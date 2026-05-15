import type { Messages } from "@/lib/i18n/dictionaries";

type NavItem = {
  href: string;
  label: string;
  tourId: string | undefined;
  // Verticals that show this item. Undefined = shown for all verticals.
  verticals?: string[];
  // Stable key used for translation lookup.
  key: keyof Messages["dashboard"]["nav"];
};

const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",                    label: "Dashboard",    tourId: "dashboard-overview", key: "dashboard" },
  { href: "/dashboard/orders",             label: "Orders",       tourId: "nav-orders",         key: "orders" },
  { href: "/dashboard/calendar",           label: "Calendar",     tourId: undefined,            key: "calendar" },
  { href: "/dashboard/products",           label: "Products",     tourId: "nav-products",       key: "products" },
  { href: "/dashboard/pricing",            label: "Pricing",      tourId: "nav-pricing",        key: "pricing" },
  { href: "/dashboard/customers",          label: "Customers",    tourId: undefined,            key: "customers" },
  { href: "/dashboard/messages",           label: "Messages",     tourId: undefined,            key: "messages" },
  { href: "/dashboard/payments",           label: "Payments",     tourId: "nav-payments",       key: "payments" },
  { href: "/dashboard/documents",          label: "Documents",    tourId: "nav-documents",      key: "documents" },
  { href: "/dashboard/deliveries",         label: "Deliveries",   tourId: "nav-deliveries",     key: "deliveries",   verticals: ["inflatable", "equipment"] },
  { href: "/dashboard/maintenance",        label: "Maintenance",  tourId: undefined,            key: "maintenance" },
  { href: "/dashboard/service-areas",      label: "Service Areas",tourId: undefined,            key: "serviceAreas", verticals: ["inflatable", "equipment"] },
  { href: "/dashboard/analytics",          label: "Analytics",    tourId: undefined,            key: "analytics" },
  { href: "/dashboard/website",            label: "Website",      tourId: "nav-website",        key: "website" },
  { href: "/dashboard/settings",           label: "Settings",     tourId: undefined,            key: "settings" },
  { href: "/dashboard/settings/billing",   label: "Billing",      tourId: undefined,            key: "billing" },
  { href: "/dashboard/settings/team",      label: "Team",         tourId: undefined,            key: "team" },
  { href: "/dashboard/help",               label: "Help Center",  tourId: undefined,            key: "helpCenter" },
  { href: "/crew/today",                   label: "Crew Mobile",  tourId: undefined,            key: "crewMobile",   verticals: ["inflatable", "equipment"] },
];

export function getNavItemsForVertical(businessType: string): NavItem[] {
  return ALL_NAV_ITEMS.filter(
    (item) => !item.verticals || item.verticals.includes(businessType)
  );
}

// Backward-compatible static export for pages that don't yet have businessType context.
export const dashboardNavItems = ALL_NAV_ITEMS;

export type { NavItem };

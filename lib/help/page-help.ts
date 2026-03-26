export type PageHelpConfig = {
  key: string;
  title: string;
  description: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
};

export const pageHelpMap: Record<string, PageHelpConfig> = {
  "/dashboard": {
    key: "dashboard",
    title: "Your daily command center",
    description:
      "This dashboard shows today's bookings, deliveries, and payment activity. Use the setup checklist below to get fully operational.",
    primaryAction: { label: "Add a product", href: "/dashboard/products/new" },
    secondaryAction: { label: "View Help Center", href: "/dashboard/help" },
  },
  "/dashboard/products": {
    key: "products",
    title: "Manage your rental inventory",
    description:
      "Add inflatables with photos, pricing, and descriptions. Active products appear on your public storefront automatically.",
    primaryAction: { label: "Add new product", href: "/dashboard/products/new" },
  },
  "/dashboard/orders": {
    key: "orders",
    title: "Track every rental booking",
    description:
      "Orders move from inquiry to confirmed to delivered. Create manual bookings or wait for customers to book through your storefront.",
    primaryAction: { label: "Create order", href: "/dashboard/orders/new" },
  },
  "/dashboard/payments": {
    key: "payments",
    title: "Record deposits and payments",
    description:
      "Track payment status for each order. Record cash, check, Venmo, or Zelle payments manually. Orders auto-confirm when fully paid.",
    primaryAction: { label: "View orders", href: "/dashboard/orders" },
  },
  "/dashboard/documents": {
    key: "documents",
    title: "Rental agreements and safety waivers",
    description:
      "Generate documents for each booking. Track whether agreements have been sent and signed before the event date.",
  },
  "/dashboard/deliveries": {
    key: "deliveries",
    title: "Plan routes and dispatch crew",
    description:
      "Organize deliveries by date and route. Assign crew members and track setup, pickup, and completion status.",
  },
  "/dashboard/website": {
    key: "website",
    title: "Customize your public storefront",
    description:
      "Set your hero message, manage featured inventory, and control how your booking site looks to customers.",
    primaryAction: { label: "View storefront", href: "/" },
  },
  "/dashboard/settings": {
    key: "settings",
    title: "Business profile and configuration",
    description:
      "Update your business name, contact information, timezone, and operational preferences.",
  },
};

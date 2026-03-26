export type TourStep = {
  id: string;
  route: string;
  targetSelector: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right";
  order: number;
};

export const tourSteps: TourStep[] = [
  {
    id: "dashboard-overview",
    route: "/dashboard",
    targetSelector: '[data-tour="dashboard-overview"]',
    title: "Your Dashboard",
    description:
      "This is your command center. See today's bookings, deliveries, products, and payment activity at a glance.",
    placement: "bottom",
    order: 1,
  },
  {
    id: "nav-products",
    route: "/dashboard",
    targetSelector: '[data-tour="nav-products"]',
    title: "Products",
    description:
      "Manage your inflatable inventory here. Add new products, set pricing, upload photos, and control what appears on your storefront.",
    placement: "right",
    order: 2,
  },
  {
    id: "nav-orders",
    route: "/dashboard",
    targetSelector: '[data-tour="nav-orders"]',
    title: "Orders",
    description:
      "Track every booking from inquiry to completion. Create manual orders, send quotes, and manage the full rental lifecycle.",
    placement: "right",
    order: 3,
  },
  {
    id: "nav-payments",
    route: "/dashboard",
    targetSelector: '[data-tour="nav-payments"]',
    title: "Payments",
    description:
      "Record deposits, track balances, and manage payment status for all your orders.",
    placement: "right",
    order: 4,
  },
  {
    id: "nav-documents",
    route: "/dashboard",
    targetSelector: '[data-tour="nav-documents"]',
    title: "Documents",
    description:
      "Generate rental agreements and safety waivers. Track signing status for each booking.",
    placement: "right",
    order: 5,
  },
  {
    id: "nav-deliveries",
    route: "/dashboard",
    targetSelector: '[data-tour="nav-deliveries"]',
    title: "Deliveries & Crew",
    description:
      "Plan delivery routes, dispatch crew, and track setup/pickup status for each event.",
    placement: "right",
    order: 6,
  },
  {
    id: "nav-website",
    route: "/dashboard",
    targetSelector: '[data-tour="nav-website"]',
    title: "Website Settings",
    description:
      "Customize your public storefront — hero message, featured inventory, and booking experience.",
    placement: "right",
    order: 7,
  },
  {
    id: "setup-checklist",
    route: "/dashboard",
    targetSelector: '[data-tour="setup-checklist"]',
    title: "Setup Checklist",
    description:
      "Follow this checklist to get fully set up. Each step links directly to the relevant page.",
    placement: "top",
    order: 8,
  },
];

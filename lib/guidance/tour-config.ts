export type TourStep = {
  id: string;
  route: string;
  targetSelector: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right";
  order: number;
};

export type MiniTour = {
  id: string;
  name: string;
  description: string;
  steps: TourStep[];
};

export const dashboardTour: MiniTour = {
  id: "dashboard",
  name: "Know Your Dashboard",
  description: "A quick look at the key areas of your command center.",
  steps: [
    {
      id: "dashboard-overview",
      route: "/dashboard",
      targetSelector: '[data-tour="dashboard-overview"]',
      title: "Your Command Center",
      description:
        "This is your daily snapshot — today's bookings, deliveries, active products, and recent payment activity all in one view.",
      placement: "bottom",
      order: 1,
    },
    {
      id: "nav-orders",
      route: "/dashboard",
      targetSelector: '[data-tour="nav-orders"]',
      title: "Orders Pipeline",
      description:
        "Every booking lives here — from first inquiry to completed event. You'll create orders, send quotes, collect deposits, and track delivery status.",
      placement: "right",
      order: 2,
    },
    {
      id: "nav-products",
      route: "/dashboard",
      targetSelector: '[data-tour="nav-products"]',
      title: "Your Inventory",
      description:
        "Add bounce houses, water slides, and packages here. Set pricing, upload photos, and control what shows on your public storefront.",
      placement: "right",
      order: 3,
    },
    {
      id: "setup-checklist",
      route: "/dashboard",
      targetSelector: '[data-tour="setup-checklist"]',
      title: "Your Setup Checklist",
      description:
        "Follow these steps to get your business live. Each item links directly to the page where you'll complete it. Start from the top and work down.",
      placement: "top",
      order: 4,
    },
  ],
};

export const productTour: MiniTour = {
  id: "products",
  name: "Add Your First Product",
  description: "Learn how to list an inflatable for your catalog.",
  steps: [
    {
      id: "nav-products",
      route: "/dashboard",
      targetSelector: '[data-tour="nav-products"]',
      title: "Go to Products",
      description:
        "Click Products in the sidebar to see your inventory. When it's empty, you'll see a prompt to add your first listing.",
      placement: "right",
      order: 1,
    },
    {
      id: "nav-website",
      route: "/dashboard",
      targetSelector: '[data-tour="nav-website"]',
      title: "Customize Your Storefront",
      description:
        "After adding products, visit Website Settings to control your hero message and which rentals appear on your public booking page.",
      placement: "right",
      order: 2,
    },
    {
      id: "dashboard-overview",
      route: "/dashboard",
      targetSelector: '[data-tour="dashboard-overview"]',
      title: "Watch It Update",
      description:
        "Your dashboard stats update in real-time. Once you add a product, your 'Active products' count reflects it immediately.",
      placement: "bottom",
      order: 3,
    },
  ],
};

export const bookingTour: MiniTour = {
  id: "bookings",
  name: "Take Your First Booking",
  description: "Walk through creating an order and collecting payment.",
  steps: [
    {
      id: "nav-orders",
      route: "/dashboard",
      targetSelector: '[data-tour="nav-orders"]',
      title: "Create an Order",
      description:
        "Click Orders, then 'New order' to create a booking. Pick a customer, select products, set the event date, and the system handles availability checks.",
      placement: "right",
      order: 1,
    },
    {
      id: "nav-payments",
      route: "/dashboard",
      targetSelector: '[data-tour="nav-payments"]',
      title: "Record a Payment",
      description:
        "After creating an order, go to Payments to record a deposit. Select the order, enter the amount and method (cash, card, Venmo, etc.).",
      placement: "right",
      order: 2,
    },
    {
      id: "nav-documents",
      route: "/dashboard",
      targetSelector: '[data-tour="nav-documents"]',
      title: "Generate Documents",
      description:
        "Create rental agreements and safety waivers for your booking. PDF invoices are also available from each order's detail page.",
      placement: "right",
      order: 3,
    },
  ],
};

export const miniTours: MiniTour[] = [dashboardTour, productTour, bookingTour];

// Flat list for backward compatibility
export const tourSteps: TourStep[] = dashboardTour.steps;

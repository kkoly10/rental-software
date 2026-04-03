import type { OrderSummary, ProductSummary } from "@/lib/types";

export const mockOrders: OrderSummary[] = [
  {
    id: "ord_1001",
    customer: "[DEMO] Jane Demo",
    item: "[DEMO] Castle Bouncer",
    date: "May 24, 2026",
    total: "$245",
    status: "Confirmed",
    tone: "success",
  },
  {
    id: "ord_1002",
    customer: "[DEMO] Demo Customer",
    item: "[DEMO] Obstacle Course",
    date: "May 25, 2026",
    total: "$525",
    status: "Awaiting Deposit",
    tone: "warning",
  },
  {
    id: "ord_1003",
    customer: "[DEMO] John Sample",
    item: "[DEMO] Water Slide + Generator",
    date: "May 26, 2026",
    total: "$640",
    status: "Scheduled",
    tone: "default",
  },
];

export const mockProducts: ProductSummary[] = [
  {
    id: "prod_castle_bouncer",
    name: "[DEMO] Castle Bouncer",
    category: "Bounce House",
    price: "$165/day",
    status: "Active",
    tone: "success",
  },
  {
    id: "prod_mega_splash",
    name: "[DEMO] Mega Splash Water Slide",
    category: "Water Slide",
    price: "$279/day",
    status: "Active",
    tone: "success",
  },
  {
    id: "prod_tropical_combo",
    name: "[DEMO] Tropical Combo",
    category: "Combo Unit",
    price: "$235/day",
    status: "Maintenance",
    tone: "warning",
  },
];

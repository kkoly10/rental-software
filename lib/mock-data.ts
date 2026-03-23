export const mockOrders = [
  {
    id: "ord_1001",
    customer: "Johnson Birthday Setup",
    item: "Castle Bouncer",
    date: "May 24, 2026",
    total: "$245",
    status: "Confirmed",
    tone: "success",
  },
  {
    id: "ord_1002",
    customer: "Church Spring Event",
    item: "Obstacle Course",
    date: "May 25, 2026",
    total: "$525",
    status: "Awaiting Deposit",
    tone: "warning",
  },
  {
    id: "ord_1003",
    customer: "School Field Day",
    item: "Water Slide + Generator",
    date: "May 26, 2026",
    total: "$640",
    status: "Scheduled",
    tone: "default",
  },
] as const;

export const mockProducts = [
  {
    id: "prod_castle_bouncer",
    name: "Castle Bouncer",
    category: "Bounce House",
    price: "$165/day",
    status: "Active",
    tone: "success",
  },
  {
    id: "prod_mega_splash",
    name: "Mega Splash Water Slide",
    category: "Water Slide",
    price: "$279/day",
    status: "Active",
    tone: "success",
  },
  {
    id: "prod_tropical_combo",
    name: "Tropical Combo",
    category: "Combo Unit",
    price: "$235/day",
    status: "Maintenance",
    tone: "warning",
  },
] as const;

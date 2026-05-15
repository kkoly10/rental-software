import { getRoutes } from "@/lib/data/routes";

export async function getDeliveryBoardData() {
  const today = new Date().toISOString().split("T")[0];
  const routes = await getRoutes(today);

  const assigned = routes.filter((route) => route.status === "planned");
  const inProgress = routes.filter((route) => route.status === "in_progress");
  const completed = routes.filter((route) => route.status === "completed");

  // Prefer the first in-progress route; fall back to planned, then any route
  const primaryRoute =
    inProgress[0] ?? assigned[0] ?? routes[0] ?? null;

  return {
    assigned,
    inProgress,
    completed,
    primaryRoute,
  };
}

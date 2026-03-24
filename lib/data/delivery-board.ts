import { getRoutes } from "@/lib/data/routes";

export async function getDeliveryBoardData() {
  const routes = await getRoutes();

  const assigned = routes.filter((route) => route.status === "planned");
  const inProgress = routes.filter((route) => route.status === "in_progress");
  const completed = routes.filter((route) => route.status === "completed");

  return {
    assigned,
    inProgress,
    completed,
    primaryRoute: routes[0] ?? null,
  };
}

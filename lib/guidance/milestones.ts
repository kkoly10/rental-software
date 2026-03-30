import type { GuidanceSnapshot } from "@/lib/data/guidance-snapshot";

export type MilestoneKey =
  | "first_product"
  | "first_order"
  | "first_payment"
  | "setup_complete"
  | "ten_orders";

export function detectNewMilestone(
  snapshot: GuidanceSnapshot,
  dismissed: string[]
): MilestoneKey | null {
  const candidates: { key: MilestoneKey; condition: boolean }[] = [
    { key: "first_product", condition: snapshot.productsCount === 1 },
    { key: "first_order", condition: snapshot.ordersCount === 1 },
    { key: "first_payment", condition: snapshot.paymentsCount === 1 },
    { key: "ten_orders", condition: snapshot.ordersCount === 10 },
    {
      key: "setup_complete",
      condition:
        snapshot.hasBusinessProfile &&
        snapshot.productsCount > 0 &&
        snapshot.productImagesCount > 0 &&
        snapshot.serviceAreasCount > 0 &&
        snapshot.ordersCount > 0 &&
        snapshot.paymentsCount > 0 &&
        snapshot.documentsCount > 0 &&
        snapshot.hasWebsiteSettings,
    },
  ];

  for (const { key, condition } of candidates) {
    if (condition && !dismissed.includes(key)) {
      return key;
    }
  }

  return null;
}

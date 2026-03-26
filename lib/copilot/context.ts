import { pageHelpMap } from "@/lib/help/page-help";
import { helpArticles } from "@/lib/help/articles";
import type { GuidanceSnapshot } from "@/lib/data/guidance-snapshot";

export function getPageHelpContext(route: string): string {
  const help = pageHelpMap[route];
  if (!help) return "No specific help available for this page.";
  return `${help.title}: ${help.description}`;
}

export function getSnapshotContext(snapshot: GuidanceSnapshot): string {
  const lines = [
    `Business name: ${snapshot.businessName || "(not set)"}`,
    `Support email: ${snapshot.supportEmail || "(not set)"}`,
    `Phone: ${snapshot.phone || "(not set)"}`,
    `Business profile complete: ${snapshot.hasBusinessProfile ? "Yes" : "No"}`,
    `Products: ${snapshot.productsCount}`,
    `Product images: ${snapshot.productImagesCount}`,
    `Service areas: ${snapshot.serviceAreasCount}`,
    `Orders: ${snapshot.ordersCount}`,
    `Payments: ${snapshot.paymentsCount}`,
    `Documents: ${snapshot.documentsCount}`,
    `Website hero message: ${snapshot.hasWebsiteSettings ? "Set" : "Not set"}`,
  ];
  return lines.join("\n");
}

export function getArticleSummaries(): string {
  return helpArticles
    .map((a) => `[${a.section}] ${a.title}: ${a.summary}`)
    .join("\n");
}

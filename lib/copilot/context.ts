import { pageHelpMap } from "@/lib/help/page-help";
import { helpArticles } from "@/lib/help/articles";
import type { GuidanceSnapshot } from "@/lib/data/guidance-snapshot";
import type { OperationalSnapshot } from "@/lib/data/operational-snapshot";
import { formatMoney } from "@/lib/i18n/format-helpers";

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  pt: "Portuguese",
};

function localeName(code: string): string {
  return LOCALE_NAMES[code] ?? "English";
}

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

export function getOperationalContext(snapshot: OperationalSnapshot): string {
  if (!snapshot.available) {
    return "Live operational data is not available right now (demo mode or not signed in). Answer questions in general terms and point the operator to the relevant dashboard page.";
  }

  const money = (n: number) => formatMoney(n, snapshot.currency, snapshot.locale);

  const lines = [
    `Money owed to the business right now (outstanding balance across live orders): ${money(snapshot.outstandingBalance)}`,
    `Revenue collected so far this month: ${money(snapshot.revenueThisMonth)} across ${snapshot.paymentsThisMonthCount} payment${snapshot.paymentsThisMonthCount === 1 ? "" : "s"}`,
    `Events happening today: ${snapshot.eventsToday}`,
    `Events in the next 7 days: ${snapshot.eventsNext7Days}`,
    `Upcoming orders (next 7 days) with a balance still owed: ${snapshot.balanceDueSoonCount}${snapshot.balanceDueSoonCount > 0 ? ` (totaling ${money(snapshot.balanceDueSoonTotal)})` : ""}`,
    `Documents still unsigned for upcoming events: ${snapshot.unsignedDocsUpcoming}`,
    `Unread customer messages: ${snapshot.unreadMessages}`,
    `Assets currently in maintenance / out of service: ${snapshot.openMaintenance}`,
  ];

  if (snapshot.attentionOrders.length > 0) {
    lines.push(
      "",
      "Specific upcoming orders that still owe money (use these exact markdown links when referring to them so the operator can click straight through; the orderId is for recording a payment via an ACTION block):"
    );
    for (const o of snapshot.attentionOrders) {
      lines.push(
        `- [${o.label}](${o.link}) — ${money(o.balance)} due${o.eventDate ? `, event ${o.eventDate}` : ""} (orderId: ${o.id})`
      );
    }
  }

  if (snapshot.actionableOrders.length > 0) {
    lines.push(
      "",
      "Open orders you can act on (use the orderId + current status to propose a valid status change via an ACTION block; link them so the operator can click through):"
    );
    for (const o of snapshot.actionableOrders) {
      lines.push(
        `- [${o.label}](${o.link}) — status: ${o.status}${o.eventDate ? `, event ${o.eventDate}` : ""}, customer language: ${localeName(o.customerLocale)} (orderId: ${o.id})`
      );
    }
  }

  if (snapshot.unreadThreads.length > 0) {
    lines.push(
      "",
      "Unread customer messages you can draft a reply to (use the customerEmail/customerId/orderId/orderNumber to send a reply via a send_reply ACTION block; draft the reply grounded in the message text AND written in the customer's preferred language shown below):"
    );
    for (const t of snapshot.unreadThreads) {
      lines.push(
        `- From ${t.customerName} [prefers ${localeName(t.customerLocale)}] (customerEmail: ${t.customerEmail ?? "unknown"}${t.customerId ? `, customerId: ${t.customerId}` : ""}${t.orderNumber ? `, order #${t.orderNumber}` : ""}${t.orderId ? `, orderId: ${t.orderId}` : ""}): "${t.snippet}"`
      );
    }
  }

  return lines.join("\n");
}

export function getArticleSummaries(): string {
  return helpArticles
    .map((a) => `[${a.section}] ${a.title}: ${a.summary}`)
    .join("\n");
}

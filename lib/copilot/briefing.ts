import type { OperationalSnapshot } from "@/lib/data/operational-snapshot";

// Inlined (mirrors lib/i18n/format-helpers formatMoney) so this module stays
// free of runtime `@/` imports and is unit-testable under node:test.
function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/**
 * Build a proactive daily briefing from the operational snapshot — the same
 * "what needs my attention" roundup, shown automatically when the Copilot
 * opens instead of waiting to be asked. Deterministic (no AI). Returns null
 * when there's nothing worth surfacing (no schedule + no open tasks), so the
 * panel falls back to its normal empty state.
 */
export function buildDailyBriefing(s: OperationalSnapshot): string | null {
  if (!s.available) return null;

  const money = (n: number) => formatMoney(n, s.currency, s.locale);
  const plural = (n: number) => (n === 1 ? "" : "s");

  const items: string[] = [];
  if (s.balanceDueSoonCount > 0) {
    items.push(
      `- **${s.balanceDueSoonCount} upcoming order${plural(s.balanceDueSoonCount)}** still owe ${money(s.balanceDueSoonTotal)} — collect at [Payments](/dashboard/payments)`
    );
  }
  if (s.unsignedDocsUpcoming > 0) {
    items.push(
      `- **${s.unsignedDocsUpcoming} document${plural(s.unsignedDocsUpcoming)}** unsigned for upcoming events — chase at [Documents](/dashboard/documents)`
    );
  }
  if (s.unreadMessages > 0) {
    items.push(
      `- **${s.unreadMessages} unread message${plural(s.unreadMessages)}** — reply at [Messages](/dashboard/messages)`
    );
  }
  if (s.openMaintenance > 0) {
    items.push(
      `- **${s.openMaintenance} asset${plural(s.openMaintenance)}** in maintenance — review at [Maintenance](/dashboard/maintenance)`
    );
  }

  const hasSchedule = s.eventsToday > 0 || s.eventsNext7Days > 0;
  if (items.length === 0 && !hasSchedule) return null;

  const header =
    s.eventsToday > 0
      ? `👋 Here's your briefing — you have **${s.eventsToday} event${plural(s.eventsToday)} today** and ${s.eventsNext7Days} in the next 7 days.`
      : `👋 Here's your briefing — **${s.eventsNext7Days} event${plural(s.eventsNext7Days)}** in the next 7 days.`;

  if (items.length === 0) {
    return `${header}\n\nNothing's blocking your upcoming events — you're in good shape. 🎉`;
  }
  return `${header}\n\nWhat needs your attention:\n\n${items.join("\n")}`;
}

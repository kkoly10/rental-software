import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyBriefing } from "../lib/copilot/briefing.ts";
import type { OperationalSnapshot } from "../lib/data/operational-snapshot.ts";

function snap(overrides: Partial<OperationalSnapshot> = {}): OperationalSnapshot {
  return {
    outstandingBalance: 0,
    revenueThisMonth: 0,
    paymentsThisMonthCount: 0,
    eventsToday: 0,
    eventsNext7Days: 0,
    balanceDueSoonCount: 0,
    balanceDueSoonTotal: 0,
    unsignedDocsUpcoming: 0,
    unreadMessages: 0,
    openMaintenance: 0,
    attentionOrders: [],
    actionableOrders: [],
    unreadThreads: [],
    currency: "USD",
    locale: "en",
    available: true,
    ...overrides,
  };
}

test("returns null when data isn't available (demo mode)", () => {
  assert.equal(buildDailyBriefing(snap({ available: false })), null);
});

test("returns null when there's nothing to report", () => {
  assert.equal(buildDailyBriefing(snap()), null);
});

test("summarizes attention items with the schedule header", () => {
  const b = buildDailyBriefing(
    snap({
      eventsToday: 2,
      eventsNext7Days: 5,
      balanceDueSoonCount: 3,
      balanceDueSoonTotal: 750,
      unreadMessages: 1,
    })
  );
  assert.ok(b);
  assert.match(b!, /2 event.* today/);
  assert.match(b!, /3 upcoming order/);
  assert.match(b!, /\$750/);
  assert.match(b!, /1 unread message\b/); // singular, no trailing s
  assert.match(b!, /\[Payments\]\(\/dashboard\/payments\)/);
});

test("celebrates when there are events but nothing blocking", () => {
  const b = buildDailyBriefing(snap({ eventsNext7Days: 4 }));
  assert.ok(b);
  assert.match(b!, /4 events.* in the next 7 days/);
  assert.match(b!, /good shape/);
});

test("shows a briefing for open tasks even with no upcoming events", () => {
  const b = buildDailyBriefing(snap({ unreadMessages: 2 }));
  assert.ok(b);
  assert.match(b!, /2 unread messages/);
});

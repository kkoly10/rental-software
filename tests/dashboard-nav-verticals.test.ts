import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  getNavItemsForVertical,
  getGroupedNavItemsForVertical,
} from "../lib/navigation/dashboard-nav.ts";

// Phase 4 — pin the dashboard nav whitelist so the registry verticals
// from #287 all see the delivery / service-area / crew-mobile nav
// items. The previous list hardcoded ["inflatable", "equipment"]
// which silently hid those items from tents / tables / dance-floors
// operators even though those are delivery-driven businesses.

const REGISTRY_VERTICALS = [
  "inflatable",
  "tents",
  "tables-and-chairs",
  "dance-floors",
  "photo-booths",
  "concessions",
] as const;

const DELIVERY_HREFS = [
  "/dashboard/deliveries",
  "/dashboard/service-areas",
  "/crew/today",
];

test("every registry vertical sees the delivery-related nav items", () => {
  for (const vertical of REGISTRY_VERTICALS) {
    const items = getNavItemsForVertical(vertical);
    const hrefs = new Set(items.map((i) => i.href));
    for (const href of DELIVERY_HREFS) {
      assert.ok(
        hrefs.has(href),
        `${vertical} is missing ${href} from its nav`,
      );
    }
  }
});

test("car vertical (legacy) still hides delivery items", () => {
  // Cars are picked up at the lot, not delivered to the customer, so
  // these nav items would be confusing for a car-rental operator.
  const items = getNavItemsForVertical("car");
  const hrefs = new Set(items.map((i) => i.href));
  for (const href of DELIVERY_HREFS) {
    assert.equal(
      hrefs.has(href),
      false,
      `car should not see ${href}`,
    );
  }
});

test("getGroupedNavItemsForVertical returns ops group with deliveries for tents", () => {
  const { groups } = getGroupedNavItemsForVertical("tents");
  const ops = groups.find((g) => g.id === "ops");
  assert.ok(ops, "ops group missing for tents");
  const hrefs = new Set(ops!.items.map((i) => i.href));
  assert.ok(hrefs.has("/dashboard/deliveries"));
});

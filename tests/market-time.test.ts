import { test } from "node:test";
import assert from "node:assert/strict";

import { marketWallClock, formatMarketDate, MARKET_TZ } from "../lib/market/time.ts";

test("marketWallClock: 9am NY is 13:00 or 14:00 UTC depending on DST", () => {
  // June → EDT (UTC-4) → 9:00 EDT = 13:00 UTC
  const summer = marketWallClock("2026-06-15", 9, 0);
  assert.equal(summer.toISOString(), "2026-06-15T13:00:00.000Z");
  // January → EST (UTC-5) → 9:00 EST = 14:00 UTC
  const winter = marketWallClock("2026-01-15", 9, 0);
  assert.equal(winter.toISOString(), "2026-01-15T14:00:00.000Z");
});

test("marketWallClock: the wall-clock date is preserved (the bug being fixed)", () => {
  // A UTC parse of "2026-06-15T09:00" on a UTC server is 09:00Z, which
  // is still June 15 in NY — but late-evening bookings are the failure
  // case. 6pm end on Jun 15 NY must read as Jun 15, not Jun 16.
  const end = marketWallClock("2026-06-15", 18, 0);
  assert.equal(formatMarketDate(end), "Jun 15, 2026");
});

test("formatMarketDate renders in the marketplace timezone", () => {
  // 02:00 UTC on Jun 16 is still 22:00 (10pm) Jun 15 in NY.
  assert.equal(formatMarketDate("2026-06-16T02:00:00.000Z"), "Jun 15, 2026");
  assert.equal(MARKET_TZ, "America/New_York");
});

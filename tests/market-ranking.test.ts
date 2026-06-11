import { test } from "node:test";
import assert from "node:assert/strict";

import { rankListings, sellerScore, type SellerStats } from "../lib/market/ranking.ts";

const stats = (s: Partial<SellerStats>): SellerStats => ({
  avgRating: null,
  reviewCount: 0,
  completedBookings: 0,
  disputes: 0,
  ...s,
});

test("§21: higher-rated seller outranks; price is not an input", () => {
  const m = new Map([
    ["good", stats({ avgRating: 4.9, completedBookings: 10 })],
    ["new", stats({})],
    ["bad", stats({ avgRating: 4.9, disputes: 2 })],
  ]);
  const ranked = rankListings(
    [
      { organizationId: "new", isPrelist: false },
      { organizationId: "bad", isPrelist: false },
      { organizationId: "good", isPrelist: false },
    ],
    m,
  );
  assert.deepEqual(
    ranked.map((r) => r.organizationId),
    ["good", "new", "bad"],
  );
});

test("cold-start sellers get a neutral score, not zero", () => {
  assert.ok(sellerScore(undefined) > 6); // 3.5 * 2
  assert.ok(sellerScore(stats({ avgRating: 2 })) < sellerScore(undefined));
});

test("pre-listings always sink below bookable inventory", () => {
  const m = new Map([["star", stats({ avgRating: 5, completedBookings: 20 })]]);
  const ranked = rankListings(
    [
      { organizationId: "star", isPrelist: true },
      { organizationId: "nobody", isPrelist: false },
    ],
    m,
  );
  assert.equal(ranked[0]!.organizationId, "nobody");
});

test("completions cap at 20 so volume can't drown rating", () => {
  const big = sellerScore(stats({ avgRating: 4, completedBookings: 500 }));
  const capped = sellerScore(stats({ avgRating: 4, completedBookings: 20 }));
  assert.equal(big, capped);
});

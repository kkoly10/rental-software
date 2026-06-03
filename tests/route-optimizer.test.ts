/**
 * Tests for the route-optimizer orchestration layer (Sprint 5).
 *
 * The orchestration is the brain of the route-optimize feature: it
 * decides which stops are locked (and must stay at the head of the
 * ordered list), which are optimizable, and which fall to the tail
 * because they're missing coordinates. The provider only sees the
 * filtered-and-coords-present subset.
 *
 * These tests pin every branch of that decision tree against a fake
 * provider so the math + filtering is verified without needing a
 * Mapbox API key.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  runOptimization,
  type OptimizeStop,
  type RouteOptimizerProvider,
} from "../lib/logistics/route-optimizer.ts";

function fakeProvider(
  response:
    | { ok: true; orderedStopIds: string[]; totalDistanceMeters: number; totalDurationSeconds: number }
    | { ok: false; reason: "not_configured" | "rate_limited" | "validation" | "server" | "network"; detail?: string },
): RouteOptimizerProvider & { lastInput?: { stops: { id: string; lat: number; lng: number }[] } } {
  const provider: RouteOptimizerProvider & {
    lastInput?: { stops: { id: string; lat: number; lng: number }[] };
  } = {
    id: "mapbox",
    async optimize(input) {
      provider.lastInput = { stops: input.stops };
      return response;
    },
  };
  return provider;
}

test("happy path: 3 pending stops with coords get reordered per provider response", async () => {
  const stops: OptimizeStop[] = [
    { id: "a", sequence: 1, status: "pending", lat: 40.0, lng: -75.0 },
    { id: "b", sequence: 2, status: "pending", lat: 40.1, lng: -75.1 },
    { id: "c", sequence: 3, status: "pending", lat: 40.2, lng: -75.2 },
  ];
  const provider = fakeProvider({
    ok: true,
    orderedStopIds: ["c", "a", "b"],
    totalDistanceMeters: 12345,
    totalDurationSeconds: 1800,
  });
  const result = await runOptimization({ stops }, provider);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.result.orderedStopIds, ["c", "a", "b"]);
  assert.equal(result.result.totalDistanceMeters, 12345);
  assert.equal(result.result.totalDurationSeconds, 1800);
  assert.equal(result.result.unoptimizedStopIds.length, 0);
  // Provider only saw the 3 optimizable stops.
  assert.equal(provider.lastInput?.stops.length, 3);
});

test("locked stops (en_route / completed / skipped) keep their original sequence at the head", async () => {
  const stops: OptimizeStop[] = [
    { id: "done", sequence: 1, status: "completed", lat: 40.0, lng: -75.0 },
    { id: "rolling", sequence: 2, status: "en_route", lat: 40.1, lng: -75.1 },
    { id: "next", sequence: 3, status: "pending", lat: 40.2, lng: -75.2 },
    { id: "later", sequence: 4, status: "pending", lat: 40.3, lng: -75.3 },
  ];
  const provider = fakeProvider({
    ok: true,
    orderedStopIds: ["later", "next"],
    totalDistanceMeters: 1000,
    totalDurationSeconds: 600,
  });
  const result = await runOptimization({ stops }, provider);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Locked stops in original sequence first, then the provider's order.
  assert.deepEqual(result.result.orderedStopIds, ["done", "rolling", "later", "next"]);
  // Provider only saw the two pending stops.
  assert.equal(provider.lastInput?.stops.length, 2);
  const sentIds = provider.lastInput?.stops.map((s) => s.id);
  assert.deepEqual(sentIds, ["next", "later"]);
});

test("stops with missing coords fall to the tail and are reported as unoptimized", async () => {
  const stops: OptimizeStop[] = [
    { id: "geocoded", sequence: 1, status: "pending", lat: 40.0, lng: -75.0 },
    { id: "no_lat", sequence: 2, status: "pending", lat: null, lng: -75.1 },
    { id: "no_lng", sequence: 3, status: "pending", lat: 40.2, lng: null },
    { id: "also_geocoded", sequence: 4, status: "pending", lat: 40.3, lng: -75.3 },
  ];
  const provider = fakeProvider({
    ok: true,
    orderedStopIds: ["also_geocoded", "geocoded"],
    totalDistanceMeters: 2000,
    totalDurationSeconds: 700,
  });
  const result = await runOptimization({ stops }, provider);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Optimized first, then unoptimizable tail.
  assert.deepEqual(result.result.orderedStopIds, ["also_geocoded", "geocoded", "no_lat", "no_lng"]);
  assert.deepEqual(result.result.unoptimizedStopIds, ["no_lat", "no_lng"]);
});

test("short-circuit when fewer than 2 optimizable stops — no provider call", async () => {
  const stops: OptimizeStop[] = [
    { id: "only", sequence: 1, status: "pending", lat: 40.0, lng: -75.0 },
  ];
  const provider = fakeProvider({
    ok: true,
    orderedStopIds: ["only"],
    totalDistanceMeters: 999,
    totalDurationSeconds: 999,
  });
  const result = await runOptimization({ stops }, provider);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // No call to the provider — distance / duration come back zero.
  assert.equal(result.result.totalDistanceMeters, 0);
  assert.equal(result.result.totalDurationSeconds, 0);
  assert.equal(provider.lastInput, undefined);
});

test("provider failure surfaces with the reason", async () => {
  const stops: OptimizeStop[] = [
    { id: "a", sequence: 1, status: "pending", lat: 40.0, lng: -75.0 },
    { id: "b", sequence: 2, status: "pending", lat: 40.1, lng: -75.1 },
  ];
  const provider = fakeProvider({ ok: false, reason: "rate_limited", detail: "Mapbox said slow down" });
  const result = await runOptimization({ stops }, provider);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "rate_limited");
  assert.equal(result.detail, "Mapbox said slow down");
});

test("locked stops are preserved by sequence even when input order is shuffled", async () => {
  // Mimic the case where stops come back from Supabase in
  // sequence-ascending order normally — but make sure the locked
  // partition sorts internally rather than relying on input order.
  const stops: OptimizeStop[] = [
    { id: "late_done", sequence: 5, status: "completed", lat: 40.5, lng: -75.5 },
    { id: "early_done", sequence: 1, status: "completed", lat: 40.1, lng: -75.1 },
    { id: "pending_a", sequence: 6, status: "pending", lat: 40.6, lng: -75.6 },
  ];
  const provider = fakeProvider({
    ok: true,
    orderedStopIds: ["pending_a"],
    totalDistanceMeters: 0,
    totalDurationSeconds: 0,
  });
  const result = await runOptimization({ stops }, provider);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // early_done comes before late_done despite being second in input.
  assert.deepEqual(result.result.orderedStopIds, ["early_done", "late_done", "pending_a"]);
});

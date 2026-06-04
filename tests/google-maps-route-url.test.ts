/**
 * Pins the Google Maps deeplink builder. Two surfaces depend on this
 * helper (dispatcher route detail + crew today view), so a regression
 * here breaks both at once and is hard to spot from either side.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildGoogleMapsRouteUrl } from "../lib/maps/google-maps-route-url.ts";

test("empty list → null (no CTA shown)", () => {
  assert.equal(buildGoogleMapsRouteUrl([]), null);
});

test("all stops missing addresses → null", () => {
  assert.equal(
    buildGoogleMapsRouteUrl([
      { sequence: 1, address: null },
      { sequence: 2, address: "" },
      { sequence: 3, address: "   " },
    ]),
    null,
  );
});

test("single addressed stop → destination only (no origin)", () => {
  const url = buildGoogleMapsRouteUrl([
    { sequence: 1, address: "123 Main St, Atlanta, GA" },
  ])!;
  assert.ok(url.includes("destination=123%20Main%20St%2C%20Atlanta%2C%20GA"));
  assert.ok(!url.includes("origin="));
  assert.ok(!url.includes("waypoints="));
});

test("two stops → origin + destination, no waypoints", () => {
  const url = buildGoogleMapsRouteUrl([
    { sequence: 1, address: "A" },
    { sequence: 2, address: "B" },
  ])!;
  assert.ok(url.includes("origin=A"));
  assert.ok(url.includes("destination=B"));
  assert.ok(!url.includes("waypoints="));
});

test("three stops → middle becomes a waypoint", () => {
  const url = buildGoogleMapsRouteUrl([
    { sequence: 1, address: "A" },
    { sequence: 2, address: "B" },
    { sequence: 3, address: "C" },
  ])!;
  assert.ok(url.includes("origin=A"));
  assert.ok(url.includes("destination=C"));
  assert.ok(url.includes("waypoints=B"));
});

test("stops respect sequence order, not array order", () => {
  const url = buildGoogleMapsRouteUrl([
    { sequence: 3, address: "C" },
    { sequence: 1, address: "A" },
    { sequence: 2, address: "B" },
  ])!;
  assert.ok(url.includes("origin=A"));
  assert.ok(url.includes("destination=C"));
  assert.ok(url.includes("waypoints=B"));
});

test("unaddressed stops between are dropped, sequence still drives ordering", () => {
  const url = buildGoogleMapsRouteUrl([
    { sequence: 1, address: "A" },
    { sequence: 2, address: null },
    { sequence: 3, address: "C" },
    { sequence: 4, address: "" },
    { sequence: 5, address: "E" },
  ])!;
  assert.ok(url.includes("origin=A"));
  assert.ok(url.includes("destination=E"));
  // C is the only middle survivor — should be the only waypoint
  assert.ok(/waypoints=C(?:&|$)/.test(url));
});

test("addresses are URL-encoded", () => {
  const url = buildGoogleMapsRouteUrl([
    { sequence: 1, address: "265 Park Ave W NW, Atlanta, GA 30313" },
    { sequence: 2, address: "200 Auburn Ave NE, Atlanta, GA 30303" },
  ])!;
  // Commas and spaces must be encoded so Maps parses the param correctly
  assert.ok(!url.includes(", "));
  assert.ok(url.includes("%2C"));
  assert.ok(url.includes("%20"));
});

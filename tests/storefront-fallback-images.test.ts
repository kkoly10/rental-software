import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  getStorefrontFallbackImage,
  getStorefrontFallbackGallery,
} from "../lib/media/storefront-fallback-images.ts";

// Phase 4 follow-up — multi-vertical fallback art. Before this, any
// product slug or category that didn't say "water" / "combo" /
// "obstacle" / "package" fell through to a bounce-house photo, so a
// "Frame Tent" or "Chiavari Chair" landed on a bouncy castle.
//
// These tests pin the new routing so a refactor can't silently
// re-introduce the bouncer photo for non-inflatable categories.

function isSvgDataUri(value: string): boolean {
  return value.startsWith("data:image/svg+xml");
}

function isInflatableUnsplash(value: string): boolean {
  return value.includes("images.unsplash.com");
}

test("tent categories return the tent SVG fallback", () => {
  for (const c of ["Frame Tent", "Pole Tent", "Sidewalls", "tent-lighting"]) {
    const url = getStorefrontFallbackImage(undefined, c);
    assert.ok(isSvgDataUri(url), `expected SVG fallback for "${c}", got ${url.slice(0, 60)}`);
    assert.ok(decodeURIComponent(url).includes("Tent"), `tent label missing for "${c}"`);
  }
});

test("chair / table categories return the chairs-and-tables SVG", () => {
  for (const c of [
    "Chiavari Chair",
    "Folding Chair",
    "Round Table",
    "Banquet Table",
    "Linens",
  ]) {
    const url = getStorefrontFallbackImage(undefined, c);
    assert.ok(isSvgDataUri(url), `expected SVG for "${c}"`);
    assert.ok(
      decodeURIComponent(url).includes("Chairs"),
      `chairs label missing for "${c}"`,
    );
  }
});

test("photo-booth categories return the photo-booth SVG", () => {
  for (const c of [
    "Open-Air Photo Booth",
    "Enclosed Photo Booth",
    "360° Video Booth",
    "Mirror Photo Booth",
    "Selfie Pod",
  ]) {
    const url = getStorefrontFallbackImage(undefined, c);
    assert.ok(isSvgDataUri(url), `expected SVG for "${c}"`);
    assert.ok(
      decodeURIComponent(url).includes("Photo Booth"),
      `photo booth label missing for "${c}"`,
    );
  }
});

test("concession categories return the concession SVG", () => {
  for (const c of [
    "Popcorn Machine",
    "Snow Cone Machine",
    "Cotton Candy Machine",
    "Hot Dog Roller",
    "Frozen Drink Machine",
  ]) {
    const url = getStorefrontFallbackImage(undefined, c);
    assert.ok(isSvgDataUri(url), `expected SVG for "${c}"`);
    assert.ok(
      decodeURIComponent(url).includes("Concessions"),
      `concession label missing for "${c}"`,
    );
  }
});

test("dance floor / stage categories return the dance-floor SVG", () => {
  for (const c of [
    "Parquet Dance Floor",
    "LED Dance Floor",
    "Stage Sections",
  ]) {
    const url = getStorefrontFallbackImage(undefined, c);
    assert.ok(isSvgDataUri(url), `expected SVG for "${c}"`);
    assert.ok(
      decodeURIComponent(url).includes("Dance"),
      `dance label missing for "${c}"`,
    );
  }
});

test("inflatable categories still get the existing Unsplash photos", () => {
  assert.ok(isInflatableUnsplash(getStorefrontFallbackImage(undefined, "Water Slide")));
  assert.ok(isInflatableUnsplash(getStorefrontFallbackImage(undefined, "Combo Unit")));
  assert.ok(
    isInflatableUnsplash(getStorefrontFallbackImage(undefined, "Obstacle Course")),
  );
  assert.ok(isInflatableUnsplash(getStorefrontFallbackImage(undefined, "Bounce House")));
});

test("dance-floor wins over the generic floor keyword", () => {
  // A "Sub-Floor" (tents-vertical category) could match a naive
  // /floor/ match — make sure we route on "dance floor" specifically
  // and not strip dance off.
  const danceUrl = getStorefrontFallbackImage(undefined, "Parquet Dance Floor");
  assert.ok(decodeURIComponent(danceUrl).includes("Dance"));
});

test("the gallery returns 4 copies of the resolved fallback", () => {
  const gallery = getStorefrontFallbackGallery(undefined, "Frame Tent");
  assert.equal(gallery.length, 4);
  assert.ok(gallery.every((url) => url === gallery[0]));
});

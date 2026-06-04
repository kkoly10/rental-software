/**
 * Sprint 6.0 — operator/crew item-line renderer.
 *
 * Pins the contract that the order detail page, the printable pull
 * sheet, and the crew today card depend on. A regression here means
 * either (a) silent missing mode badge, (b) silent missing Bring:
 * line, or (c) garbled labels in a non-English locale. All three
 * are operator-visible quality bugs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { formatInflatableItemLine } from "../lib/inflatable/format-item-line.ts";
import { en } from "../lib/i18n/messages/en.ts";
import { es } from "../lib/i18n/messages/es.ts";

const enLabels = en.forms.editProduct.inflatableSetup;
const enBring = enLabels.bringPrefix;
const esLabels = es.forms.editProduct.inflatableSetup;
const esBring = esLabels.bringPrefix;

test("plain item with no mode/anchoring → just the name", () => {
  const out = formatInflatableItemLine(
    { itemName: "Castle Bouncer" },
    enLabels,
    enBring,
  );
  assert.equal(out, "Castle Bouncer");
});

test("wet mode appends locale-correct bracketed badge", () => {
  const out = formatInflatableItemLine(
    { itemName: "Tropical Combo", selectedMode: "wet" },
    enLabels,
    enBring,
  );
  assert.equal(out, "Tropical Combo (Wet)");
});

test("dry mode also renders the badge (so the crew sees the choice was made)", () => {
  const out = formatInflatableItemLine(
    { itemName: "Tropical Combo", selectedMode: "dry" },
    enLabels,
    enBring,
  );
  assert.equal(out, "Tropical Combo (Dry)");
});

test("invalid/missing mode → no badge", () => {
  const a = formatInflatableItemLine(
    { itemName: "Castle Bouncer", selectedMode: null },
    enLabels,
    enBring,
  );
  const b = formatInflatableItemLine(
    { itemName: "Castle Bouncer", selectedMode: "garbage" },
    enLabels,
    enBring,
  );
  assert.equal(a, "Castle Bouncer");
  assert.equal(b, "Castle Bouncer");
});

test("anchoring methods + count → Bring: line with ×N", () => {
  const out = formatInflatableItemLine(
    {
      itemName: "Castle Bouncer",
      anchoringMethods: ["stakes", "sandbags"],
      requiredAnchorCount: 6,
    },
    enLabels,
    enBring,
  );
  assert.equal(
    out,
    "Castle Bouncer - Bring: Steel stakes (grass), Sandbags ×6",
  );
});

test("anchoring methods, no count → Bring: line without ×N", () => {
  const out = formatInflatableItemLine(
    {
      itemName: "Castle Bouncer",
      anchoringMethods: ["stakes"],
      requiredAnchorCount: null,
    },
    enLabels,
    enBring,
  );
  assert.equal(out, "Castle Bouncer - Bring: Steel stakes (grass)");
});

test("empty anchoring methods → no Bring: line at all", () => {
  const out = formatInflatableItemLine(
    {
      itemName: "Castle Bouncer",
      anchoringMethods: [],
      requiredAnchorCount: 6,
    },
    enLabels,
    enBring,
  );
  assert.equal(out, "Castle Bouncer");
});

test("invalid anchoring values are filtered (defensive against schema drift)", () => {
  const out = formatInflatableItemLine(
    {
      itemName: "Castle Bouncer",
      anchoringMethods: ["stakes", "gravel_bags", "stakes_with_concrete"],
      requiredAnchorCount: 4,
    },
    enLabels,
    enBring,
  );
  // Only "stakes" survives the CHECK-mirror filter.
  assert.equal(out, "Castle Bouncer - Bring: Steel stakes (grass) ×4");
});

test("mode + anchoring combine cleanly", () => {
  const out = formatInflatableItemLine(
    {
      itemName: "Tropical Combo",
      selectedMode: "wet",
      anchoringMethods: ["sandbags"],
      requiredAnchorCount: 8,
    },
    enLabels,
    enBring,
  );
  assert.equal(out, "Tropical Combo (Wet) - Bring: Sandbags ×8");
});

test("Spanish locale renders Mojado + Llevar + localized anchoring labels", () => {
  const out = formatInflatableItemLine(
    {
      itemName: "Combo Tropical",
      selectedMode: "wet",
      anchoringMethods: ["sandbags"],
      requiredAnchorCount: 8,
    },
    esLabels,
    esBring,
  );
  assert.equal(out, "Combo Tropical (Mojado) - Llevar: Sacos de arena ×8");
});

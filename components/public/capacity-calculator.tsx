"use client";

import { useState } from "react";
import { recommendDanceFloorSections } from "@/lib/capabilities/display/capacity-calculator";

/**
 * Phase 1c — storefront capacity-calculator widget.
 *
 * Renders different copy + UI based on the product's capacity_metric:
 *
 *   - "guests"   → static "Comfortably fits up to N guests" badge.
 *                  Used by tents — the product itself encodes its
 *                  capacity; the customer reads, then compares to
 *                  their guest count mentally.
 *
 *   - "dancers"  → interactive "How many guests will be dancing?"
 *                  input that runs the recommendDanceFloorSections
 *                  helper (industry math: 30–50% of guests dance,
 *                  4 sq ft per dancer, 9 sq ft per 3×3 section) and
 *                  shows a conservative + generous recommendation.
 *
 *   - "sq_ft"    → static "X sq ft" badge — used by tent footprints,
 *                  dance floor base sizing. Customer cross-references
 *                  with their venue's dimensions.
 *
 *   - "servings" → static "Makes X servings" badge — used by
 *                  concessions (e.g. "200 cones per bag of ice").
 *
 * Renders inline as a card matching the other PDP capability cards
 * (specs, variants, add-ons). Hidden when capability_value is null.
 */

export function CapacityCalculator({
  metric,
  value,
}: {
  metric: "guests" | "sq_ft" | "dancers" | "servings";
  value: number;
}) {
  if (metric === "dancers") {
    return <DanceFloorCalculator sectionsPerProduct={value} />;
  }

  const { kicker, body } = staticCopy(metric, value);
  return (
    <div className="order-card" style={{ marginTop: 18, padding: 16 }}>
      <strong
        style={{
          display: "block",
          fontSize: "0.78rem",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--text-muted, #6b7280)",
          marginBottom: 8,
        }}
      >
        {kicker}
      </strong>
      <div style={{ fontSize: 15 }}>{body}</div>
    </div>
  );
}

function DanceFloorCalculator({ sectionsPerProduct }: { sectionsPerProduct: number }) {
  // Default to a common wedding size (100 guests) so the customer
  // sees a sensible recommendation before they type. The input is
  // controlled so a typo doesn't break the math; the helper itself
  // clamps negatives and truncates fractions.
  const [guestCount, setGuestCount] = useState<number>(100);
  const rec = recommendDanceFloorSections(guestCount);

  // sectionsPerProduct lets the operator say "this listing is a
  // 12-section dance floor"; we use it to translate the helper's
  // section count into "you need ~1.5 of these listings" / "this
  // listing comfortably handles up to N guests". For most operators
  // who size their listings per-event (e.g. they only have one floor
  // and rent the whole thing), sectionsPerProduct === recommendation
  // means a single listing covers it.

  return (
    <div className="order-card" style={{ marginTop: 18, padding: 16 }}>
      <strong
        style={{
          display: "block",
          fontSize: "0.78rem",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--text-muted, #6b7280)",
          marginBottom: 8,
        }}
      >
        Sizing calculator
      </strong>

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 13 }}>How many guests are you expecting?</span>
        <input
          type="number"
          min={0}
          step={10}
          value={guestCount}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            setGuestCount(Number.isFinite(n) && n > 0 ? n : 0);
          }}
          style={{
            padding: "8px 10px",
            fontSize: 15,
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 6,
            maxWidth: 180,
          }}
        />
      </label>

      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
        <div>
          <strong>{rec.conservativeSections}</strong>–
          <strong>{rec.generousSections}</strong> sections recommended
          {sectionsPerProduct > 0 ? (
            <span className="muted" style={{ marginLeft: 6 }}>
              (this listing has {sectionsPerProduct})
            </span>
          ) : null}
        </div>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          Based on the industry standard: 30–50% of guests dance, ~4 sq ft per
          dancer, 9 sq ft per 3×3 section. Rounded up for breathing room.
        </div>
      </div>
    </div>
  );
}

function staticCopy(
  metric: "guests" | "sq_ft" | "servings",
  value: number,
): { kicker: string; body: string } {
  switch (metric) {
    case "guests":
      return {
        kicker: "Capacity",
        body: `Comfortably fits up to ${value} guests.`,
      };
    case "sq_ft":
      return {
        kicker: "Footprint",
        body: `${value} square feet — cross-reference with your venue's dimensions.`,
      };
    case "servings":
      return {
        kicker: "Yield",
        body: `Makes about ${value} servings per rental.`,
      };
  }
}
